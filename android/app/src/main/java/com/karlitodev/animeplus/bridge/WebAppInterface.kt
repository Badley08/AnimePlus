package com.karlitodev.animeplus.bridge

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.getSystemService
import com.karlitodev.animeplus.update.UpdateChecker
import com.karlitodev.animeplus.utils.HashUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.util.concurrent.TimeUnit

class WebAppInterface(
    private val context: Context,
    private val webView: WebView
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    // Requête HTTP GET native intégrée (bypasse tout problème CORS et Cloudflare Referer)
    @JavascriptInterface
    fun httpGet(url: String, callbackId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val reqBuilder = Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")
                    .header("Accept", "*/*")

                if (url.contains("anime-sama.to")) {
                    if (url.contains("episodes.js")) {
                        reqBuilder.header("Referer", url.substringBefore("episodes.js"))
                    } else {
                        reqBuilder.header("Referer", "https://anime-sama.to/")
                    }
                } else if (url.contains("voiranime")) {
                    reqBuilder.header("Referer", "https://voiranime.be/")
                }

                val response = client.newCall(reqBuilder.build()).execute()
                val body = response.body?.string() ?: ""
                val escaped = org.json.JSONObject.quote(body)

                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onNativeHttpSuccess && window.onNativeHttpSuccess('$callbackId', $escaped)", null
                    )
                }
            } catch (e: Exception) {
                val errEscaped = org.json.JSONObject.quote(e.message ?: "Erreur réseau native")
                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onNativeHttpError && window.onNativeHttpError('$callbackId', $errEscaped)", null
                    )
                }
            }
        }
    }

    // Requête HTTP POST native (pour les recherches AJAX VoirAnime)
    @JavascriptInterface
    fun httpPost(url: String, bodyStr: String, contentType: String, callbackId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val mediaType = (contentType.ifEmpty { "application/x-www-form-urlencoded" }).toMediaTypeOrNull()
                val reqBody = bodyStr.toRequestBody(mediaType)

                val reqBuilder = Request.Builder()
                    .url(url)
                    .post(reqBody)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")
                    .header("Accept", "*/*")

                if (url.contains("voiranime")) {
                    reqBuilder.header("Referer", "https://voiranime.be/")
                }

                val response = client.newCall(reqBuilder.build()).execute()
                val body = response.body?.string() ?: ""
                val escaped = org.json.JSONObject.quote(body)

                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onNativeHttpSuccess && window.onNativeHttpSuccess('$callbackId', $escaped)", null
                    )
                }
            } catch (e: Exception) {
                val errEscaped = org.json.JSONObject.quote(e.message ?: "Erreur réseau native")
                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onNativeHttpError && window.onNativeHttpError('$callbackId', $errEscaped)", null
                    )
                }
            }
        }
    }

    // Vibration
    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(VibratorManager::class.java)
                manager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                v?.vibrate(durationMs)
            }
        } catch (_: Exception) {}
    }

    // Hash SHA-256 (délégué à Kotlin pour fiabilité)
    @JavascriptInterface
    fun sha256(input: String): String = HashUtils.sha256(input)

    // Vérifie les MAJ GitHub
    @JavascriptInterface
    fun checkUpdate(currentVersion: String) {
        CoroutineScope(Dispatchers.IO).launch {
            val result = UpdateChecker.check(currentVersion)
            CoroutineScope(Dispatchers.Main).launch {
                webView.evaluateJavascript(
                    "window.onUpdateCheck && window.onUpdateCheck($result)", null
                )
            }
        }
    }

    // Info OS pour le JS
    @JavascriptInterface
    fun getDeviceInfo(): String {
        return """{"sdk":${Build.VERSION.SDK_INT},"model":"${Build.MODEL}","brand":"${Build.BRAND}"}"""
    }

    // Indique que l'environnement natif Android est prêt
    @JavascriptInterface
    fun isNative(): Boolean = true
}
