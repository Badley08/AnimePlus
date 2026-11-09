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

    private var currentTransformer: Transformer? = null
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

        val outputDir = File(context.getExternalFilesDir(null), "AnimeCompressed").apply { mkdirs() }
        val outputName = "compressed_${System.currentTimeMillis()}.mp4"
        val outputFile = File(outputDir, outputName)

        val inputUri = when {
            inputPath.startsWith("content://") -> Uri.parse(inputPath)
            inputPath.startsWith("file://")    -> Uri.parse(inputPath)
            else -> Uri.fromFile(File(inputPath))
        }

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

        val transformer = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .addListener(object : Transformer.Listener {
                override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                    if (cancelled.get()) {
                        outputFile.delete()
                        onError("Annulé")
                    } else {
                        onSuccess(outputFile.absolutePath)
                    }
                }
                override fun onError(
                    composition: Composition,
                    exportResult: ExportResult,
                    exportException: ExportException
                ) {
                    onError(exportException.message ?: "Erreur inconnue")
                }
            })
            .build()

        currentTransformer = transformer

        // Suivi de progression sur le main thread
        val handler = Handler(Looper.getMainLooper())
        val progressRunnable = object : Runnable {
            override fun run() {
                if (cancelled.get()) return
                val progress = ProgressHolder()
                val state = transformer.getProgress(progress)
                if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
                    onProgress(progress.progress)
                }
                if (state != Transformer.PROGRESS_STATE_NOT_STARTED) {
                    handler.postDelayed(this, 300)
                }
            }
        }

        handler.post {
            transformer.start(editedMediaItem, outputFile.absolutePath)
            handler.postDelayed(progressRunnable, 300)
        }
    }

    fun cancel() {
        cancelled.set(true)
        currentTransformer?.cancel()
        currentTransformer = null
    }
}

