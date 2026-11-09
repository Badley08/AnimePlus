package com.karlitodev.animeplus.update

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object UpdateChecker {

    private const val GITHUB_API =
        "https://api.github.com/repos/Badley08/animeplus/releases/latest"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    fun check(currentVersion: String): String {
        return try {
            val request = Request.Builder()
                .url(GITHUB_API)
                .header("Accept", "application/vnd.github.v3+json")
                // GitHub exige un User-Agent explicite pour son API
                .header("User-Agent", "AnimePlus-UpdateChecker")
                .build()

            // use { } ferme toujours la réponse, même en cas d'erreur HTTP
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return errorJson("HTTP ${response.code}")
                val body = response.body?.string() ?: return errorJson("empty")

                val json = JSONObject(body)
                val latestTag = json.getString("tag_name").trimStart('v', 'V')
                val latestVersion = latestTag
                val downloadUrl = pickDownloadUrl(json)
                val changelog = readString(json, "body")
                val hasUpdate = isNewer(latestVersion, currentVersion)

                // JSONObject gère l'échappement de tous les champs (guillemets, \, retours à la ligne)
                JSONObject()
                    .put("hasUpdate", hasUpdate)
                    .put("latestVersion", latestVersion)
                    .put("downloadUrl", downloadUrl)
                    .put("changelog", changelog)
                    .toString()
            }
        } catch (e: Exception) {
            errorJson(e.message ?: "Erreur inconnue")
        }
    }

    private fun errorJson(message: String): String {
        return JSONObject().put("error", message).toString()
    }

    // optString() renvoie la chaîne "null" quand la valeur JSON est null, d'où ce helper
    private fun readString(json: JSONObject, key: String): String {
        return if (json.isNull(key)) "" else json.getString(key)
    }

    /**
     * Préfère l'asset .apk, sinon le premier asset, sinon la page de la release.
     * Évite le crash quand la release n'a aucun asset.
     */
    private fun pickDownloadUrl(json: JSONObject): String {
        val assets = json.optJSONArray("assets")
        var firstUrl: String? = null

        if (assets != null) {
            for (i in 0 until assets.length()) {
                val asset = assets.optJSONObject(i) ?: continue
                val url = readString(asset, "browser_download_url")
                if (url.isEmpty()) continue
                if (readString(asset, "name").endsWith(".apk", ignoreCase = true)) return url
                if (firstUrl == null) firstUrl = url
            }
        }
        return firstUrl ?: readString(json, "html_url")
    }

    private fun cleanVersion(version: String): String {
        return version.trim().trimStart('v', 'V').substringBefore('-').substringBefore('+')
    }

    private fun isNewer(latest: String, current: String): Boolean {
        val l = cleanVersion(latest).split(".").map { it.takeWhile { c -> c.isDigit() }.toIntOrNull() ?: 0 }
        val c = cleanVersion(current).split(".").map { it.takeWhile { ch -> ch.isDigit() }.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(l.size, c.size)) {
            val lv = l.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (lv > cv) return true
            if (lv < cv) return false
        }
        return false
    }
}