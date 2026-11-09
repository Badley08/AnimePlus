package com.karlitodev.animeplus.update

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

object UpdateChecker {

    private const val GITHUB_API =
        "https://api.github.com/repos/karlitodev/animeplus/releases/latest"

    fun check(currentVersion: String): String {
        return try {
            val client = OkHttpClient()
            val request = Request.Builder()
                .url(GITHUB_API)
                .header("Accept", "application/vnd.github.v3+json")
                .build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return """{"error":"HTTP ${response.code}"}"""
            val body = response.body?.string() ?: return """{"error":"empty"}"""
            val json = JSONObject(body)
            val latestTag = json.getString("tag_name").trimStart('v')
            val latestVersion = latestTag
            val downloadUrl = json.getJSONArray("assets")
                .getJSONObject(0).getString("browser_download_url")
            val changelog = json.getString("body")
            val hasUpdate = isNewer(latestVersion, currentVersion)
            """{"hasUpdate":$hasUpdate,"latestVersion":"$latestVersion","downloadUrl":"$downloadUrl","changelog":${JSONObject.quote(changelog)}}"""
        } catch (e: Exception) {
            """{"error":"${e.message?.replace("\"", "'")}"}"""
        }
    }

    private fun isNewer(latest: String, current: String): Boolean {
        val l = latest.split(".").map { it.toIntOrNull() ?: 0 }
        val c = current.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(l.size, c.size)) {
            val lv = l.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (lv > cv) return true
            if (lv < cv) return false
        }
        return false
    }
}

