package com.karlitodev.animeplus.bridge

import android.content.Context
import android.os.Environment
import android.os.StatFs
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class StorageBridge(context: Context) {

    // applicationContext : ne retient pas une Activity
    private val context: Context = context.applicationContext

    // Retombe sur le stockage interne si le stockage externe est indisponible (évite "null/AnimeDownloads")
    private fun baseDir(): File = context.getExternalFilesDir(null) ?: context.filesDir

    private fun downloadsDir() = File(baseDir(), "AnimeDownloads")
    private fun compressedDir() = File(baseDir(), "AnimeCompressed")

    // Seuls ces deux dossiers sont accessibles depuis le JavaScript
    private fun isInsideAllowedDir(file: File, allowSelf: Boolean): Boolean {
        return try {
            val target = file.canonicalPath
            listOf(downloadsDir(), compressedDir()).any { root ->
                val rootPath = root.canonicalPath
                (allowSelf && target == rootPath) || target.startsWith(rootPath + File.separator)
            }
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun getStorageInfo(): String {
        return try {
            // Même volume que les téléchargements ; Environment.getExternalStorageDirectory() est déprécié
            val path = context.getExternalFilesDir(null)?.path
                ?: Environment.getExternalStorageDirectory().path
            val stat = StatFs(path)
            val total = stat.blockCountLong * stat.blockSizeLong
            val free = stat.availableBlocksLong * stat.blockSizeLong
            val used = total - free
            JSONObject()
                .put("total", total)
                .put("free", free)
                .put("used", used)
                .toString()
        } catch (_: Exception) {
            """{"total":0,"free":0,"used":0}"""
        }
    }

    @JavascriptInterface
    fun getDownloadsPath(): String {
        return downloadsDir().absolutePath
    }

    @JavascriptInterface
    fun getCompressedPath(): String {
        return compressedDir().absolutePath
    }

    @JavascriptInterface
    fun listFiles(dirPath: String): String {
        return try {
            val dir = File(dirPath)
            if (!dir.exists() || !dir.isDirectory) return "[]"
            if (!isInsideAllowedDir(dir, allowSelf = true)) return "[]"

            val result = JSONArray()
            dir.listFiles()?.forEach { f ->
                // JSONObject échappe correctement les guillemets, \ et caractères spéciaux du nom
                result.put(
                    JSONObject()
                        .put("name", f.name)
                        .put("path", f.absolutePath)
                        .put("size", f.length())
                        .put("modified", f.lastModified())
                )
            }
            result.toString()
        } catch (e: Exception) {
            "[]"
        }
    }

    @JavascriptInterface
    fun deleteFile(path: String): Boolean {
        return try {
            val file = File(path)
            // Uniquement un fichier à l'intérieur des dossiers de l'app (jamais le dossier lui-même)
            if (!file.isFile) return false
            if (!isInsideAllowedDir(file, allowSelf = false)) return false
            file.delete()
        } catch (_: Exception) { false }
    }
}