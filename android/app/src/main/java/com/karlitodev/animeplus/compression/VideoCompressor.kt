package com.karlitodev.animeplus.compression

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.*
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

object VideoCompressor {

    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var currentTransformer: Transformer? = null
    @Volatile private var currentOutput: File? = null
    private var progressRunnable: Runnable? = null
    private val cancelled = AtomicBoolean(false)

    fun compress(
        context: Context,
        inputPath: String,
        quality: String,
        onProgress: (Int) -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        cancelled.set(false)

        val (width, height, bitrate) = when (quality) {
            "480p"  -> Triple(854,  480,  1_200_000)
            "720p"  -> Triple(1280, 720,  2_500_000)
            "1080p" -> Triple(1920, 1080, 5_000_000)
            else    -> Triple(1280, 720,  2_500_000)
        }

        val appContext = context.applicationContext
        val outputDir = File(appContext.getExternalFilesDir(null), "AnimeCompressed").apply { mkdirs() }
        val outputName = "compressed_${System.currentTimeMillis()}.mp4"
        val outputFile = File(outputDir, outputName)
        currentOutput = outputFile

        val inputUri = when {
            inputPath.startsWith("content://") -> Uri.parse(inputPath)
            inputPath.startsWith("file://")    -> Uri.parse(inputPath)
            else -> Uri.fromFile(File(inputPath))
        }

        // Tout le cycle Transformer (build, start, getProgress, cancel) tourne sur le main thread,
        // comme l'exige Media3. Ainsi compress() peut être appelée depuis Dispatchers.IO sans risque.
        mainHandler.post {
            if (cancelled.get()) return@post

            try {
                val effects = Effects(
                    /* audioProcessors */ listOf(),
                    /* videoEffects */ listOf(
                        Presentation.createForWidthAndHeight(
                            width, height, Presentation.LAYOUT_SCALE_TO_FIT
                        )
                    )
                )

                val editedMediaItem = EditedMediaItem.Builder(MediaItem.fromUri(inputUri))
                    .setEffects(effects)
                    .build()

                // Applique réellement le bitrate cible (il était calculé mais jamais utilisé)
                val encoderFactory = DefaultEncoderFactory.Builder(appContext)
                    .setRequestedVideoEncoderSettings(
                        VideoEncoderSettings.Builder().setBitrate(bitrate).build()
                    )
                    .build()

                val transformer = Transformer.Builder(appContext)
                    .setLooper(Looper.getMainLooper())
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setEncoderFactory(encoderFactory)
                    .addListener(object : Transformer.Listener {
                        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                            stopProgress()
                            currentTransformer = null
                            if (cancelled.get()) {
                                outputFile.delete()
                                onError("Annulé")
                            } else {
                                onProgress(100)
                                onSuccess(outputFile.absolutePath)
                            }
                        }
                        override fun onError(
                            composition: Composition,
                            exportResult: ExportResult,
                            exportException: ExportException
                        ) {
                            stopProgress()
                            currentTransformer = null
                            // Supprime le fichier partiel laissé par l'échec
                            outputFile.delete()
                            onError(exportException.message ?: "Erreur inconnue")
                        }
                    })
                    .build()

                currentTransformer = transformer

                // Suivi de progression sur le main thread
                val runnable = object : Runnable {
                    override fun run() {
                        if (cancelled.get()) return
                        val progress = ProgressHolder()
                        val state = transformer.getProgress(progress)
                        if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
                            onProgress(progress.progress)
                        }
                        if (state != Transformer.PROGRESS_STATE_NOT_STARTED) {
                            mainHandler.postDelayed(this, 300)
                        }
                    }
                }
                progressRunnable = runnable

                transformer.start(editedMediaItem, outputFile.absolutePath)
                mainHandler.postDelayed(runnable, 300)
            } catch (e: Exception) {
                // Évite un crash si la configuration ou le démarrage échoue
                stopProgress()
                currentTransformer = null
                outputFile.delete()
                onError(e.message ?: "Erreur inconnue")
            }
        }
    }

    fun cancel() {
        cancelled.set(true)
        // Transformer.cancel() doit être appelé sur son thread d'origine (main)
        mainHandler.post {
            stopProgress()
            currentTransformer?.cancel()
            currentTransformer = null
            // Supprime le fichier partiel : Media3 ne le fait pas à l'annulation
            currentOutput?.delete()
        }
    }

    private fun stopProgress() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        progressRunnable = null
    }
}