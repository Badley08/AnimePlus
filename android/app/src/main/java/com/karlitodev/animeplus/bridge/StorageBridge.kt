package com.karlitodev.animeplus.bridge

import android.content.Context
import android.os.Environment
import android.os.StatFs
import android.webkit.JavascriptInterface

class StorageBridge(private val context: Context) {

    @JavascriptInterface
    fun getStorageInfo(): String {
        val stat = StatFs(Environment.getExternalStorageDirectory().path)
        val total = stat.blockCountLong * stat.blockSizeLong
        val free = stat.availableBlocksLong * stat.blockSizeLong
        val used = total - free
        return """{"total":$total,"free":$free,"used":$used}"""
    }

    @JavascriptInterface
    fun getDownloadsPath(): String {
        val dir = java.io.File(context.getExternalFilesDir(null), "AnimeDownloads")
        return dir.absolutePath
    }

    @JavascriptInterface
    fun getCompressedPath(): String {
        val dir = java.io.File(context.getExternalFilesDir(null), "AnimeCompressed")
        return dir.absolutePath
    }

    @JavascriptInterface
    fun listFiles(dirPath: String): String {
        return try {
            val dir = java.io.File(dirPath)
            if (!dir.exists()) return "[]"
            val files = dir.listFiles()?.map { f ->
                """{"name":"${f.name}","path":"${f.absolutePath}","size":${f.length()},"modified":${f.lastModified()}}"""
            } ?: emptyList()
            "[${files.joinToString(",")}]"
        } catch (e: Exception) {
            "[]"
        }
    }

    @JavascriptInterface
    fun deleteFile(path: String): Boolean {
        return try {
            java.io.File(path).delete()
        } catch (_: Exception) { false }
    }
}

