package com.karlitodev.animeplus.download

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

object VideoDownloader {

    private val client = OkHttpClient()

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
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36")
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
            onError(e.message ?: "Erreur inconnue")
        }
    }
}

