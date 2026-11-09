package com.karlitodev.animeplus.download

import android.content.Context
import com.karlitodev.animeplus.compression.VideoCompressor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

object VideoDownloader {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    fun download(
        context: Context,
        url: String,
        filename: String,
        onProgress: (Int) -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            val dir = File(context.getExternalFilesDir(null), "AnimeDownloads").apply { mkdirs() }
            val outputFile = File(dir, filename)

            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("Accept", "*/*")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                onError("HTTP ${response.code}")
                return
            }

            val body = response.body ?: run { onError("Corps vide"); return }
            val totalBytes = body.contentLength()
            var downloadedBytes = 0L
            var lastPercent = -1

            outputFile.outputStream().use { out ->
                body.byteStream().use { input ->
                    val buffer = ByteArray(8192)
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        out.write(buffer, 0, read)
                        downloadedBytes += read
                        if (totalBytes > 0) {
                            val percent = ((downloadedBytes * 100) / totalBytes).toInt()
                            if (percent != lastPercent) {
                                lastPercent = percent
                                onProgress(percent)
                            }
                        }
                    }
                }
            }
            onSuccess(outputFile.absolutePath)
        } catch (e: Exception) {
            onError(e.message ?: "Erreur de téléchargement")
        }
    }

    /**
     * Pipeline Combiné : Téléchargement direct + Compression matérielle Media3 H.264
     */
    fun downloadAndCompress(
        context: Context,
        url: String,
        targetQuality: String,
        filename: String,
        onStage: (String, Int) -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            onStage("download", 0)
            download(
                context = context,
                url = url,
                filename = "raw_$filename",
                onProgress = { p -> onStage("download", p) },
                onSuccess = { rawFilePath ->
                    onStage("compress", 0)
                    VideoCompressor.compress(
                        context = context,
                        inputPath = rawFilePath,
                        quality = targetQuality,
                        onProgress = { p -> onStage("compress", p) },
                        onSuccess = { compressedPath ->
                            // Supprime le fichier brut pour libérer le stockage de l'utilisateur
                            try { File(rawFilePath).delete() } catch (_: Exception) {}
                            onSuccess(compressedPath)
                        },
                        onError = { err ->
                            // Si la compression échoue, garde le fichier téléchargé
                            onError("Échec compression: $err")
                        }
                    )
                },
                onError = { err -> onError("Échec téléchargement: $err") }
            )
        }
    }
}
