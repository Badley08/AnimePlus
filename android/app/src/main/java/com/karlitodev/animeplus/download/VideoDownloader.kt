package com.karlitodev.animeplus.download

import android.content.Context
import com.karlitodev.animeplus.compression.VideoCompressor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

object VideoDownloader {

    private const val BUFFER_SIZE = 32 * 1024

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    fun download(
        context: Context,
        url: String,
        filename: String,
        relativeDirectory: String = "",
        onProgress: (Int) -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        var tempFile: File? = null
        var completed = false
        try {
            val dir = downloadDirectory(context, relativeDirectory)
            val safeName = safeSegment(File(filename).name)
            val outputFile = File(dir, safeName)
            tempFile = File(dir, "$safeName.part")

            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("Accept", "*/*")
                .build()

            // use { } ferme toujours la réponse, même en cas d'erreur HTTP
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    onError("HTTP ${response.code}")
                    return
                }

                val body = response.body ?: run { onError("Corps vide"); return }
                val totalBytes = body.contentLength()

                if (totalBytes > 0 && dir.usableSpace < totalBytes) {
                    onError("Espace de stockage insuffisant")
                    return
                }

                var downloadedBytes = 0L
                var lastPercent = -1

                // Écriture dans un .part pour ne jamais laisser un fichier corrompu sous le vrai nom
                tempFile.outputStream().use { out ->
                    body.byteStream().use { input ->
                        val buffer = ByteArray(BUFFER_SIZE)
                        var read: Int
                        while (input.read(buffer).also { read = it } != -1) {
                            out.write(buffer, 0, read)
                            downloadedBytes += read
                            if (totalBytes > 0) {
                                val percent = ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
                                if (percent != lastPercent) {
                                    lastPercent = percent
                                    onProgress(percent)
                                }
                            }
                        }
                    }
                }
            }

            if (outputFile.exists()) outputFile.delete()
            if (!tempFile.renameTo(outputFile)) {
                onError("Impossible de finaliser le fichier")
                return
            }

            completed = true
            onSuccess(outputFile.absolutePath)
        } catch (e: Exception) {
            onError(e.message ?: "Erreur de téléchargement")
        } finally {
            // Nettoie le fichier partiel si le téléchargement n'a pas abouti
            if (!completed) {
                try { tempFile?.delete() } catch (_: Exception) {}
            }
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
        relativeDirectory: String = "",
        onStage: (String, Int) -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                onStage("download", 0)
                val safeFilename = safeSegment(File(filename).name)
                download(
                    context = context,
                    url = url,
                    filename = "raw_$safeFilename",
                    relativeDirectory = relativeDirectory,
                    onProgress = { p -> onStage("download", p) },
                    onSuccess = { rawFilePath ->
                        onStage("compress", 0)
                        val outputFile = File(downloadDirectory(context, relativeDirectory), safeFilename)
                        if (outputFile.exists() && !outputFile.delete()) {
                            onError("Impossible de remplacer le fichier existant")
                        } else {
                            VideoCompressor.compress(
                                context = context,
                                inputPath = rawFilePath,
                                quality = targetQuality,
                                outputPath = outputFile.absolutePath,
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
                        }
                    },
                    onError = { err -> onError("Échec téléchargement: $err") }
                )
            } catch (e: Exception) {
                // Filet de sécurité : évite un crash si un callback ou le compresseur lève une exception
                onError(e.message ?: "Erreur inattendue")
            }
        }
    }

    private fun downloadDirectory(context: Context, relativeDirectory: String): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        val root = File(base, "AnimeDownloads")
        val target = relativeDirectory
            .split('/', '\\')
            .filter { it.isNotBlank() }
            .fold(root) { parent, segment -> File(parent, safeSegment(segment)) }

        val rootPath = root.canonicalPath
        val targetPath = target.canonicalPath
        if (targetPath != rootPath && !targetPath.startsWith(rootPath + File.separator)) {
            throw IOException("Chemin de téléchargement invalide")
        }
        if (!target.exists() && !target.mkdirs()) {
            throw IOException("Impossible de créer le dossier de téléchargement")
        }
        return target
    }

    private fun safeSegment(value: String): String {
        return value
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "-")
            .trim()
            .trim('.', '-', ' ')
            .take(80)
            .ifBlank { "Anime" }
    }
}