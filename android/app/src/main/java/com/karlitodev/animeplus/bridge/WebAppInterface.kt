package com.karlitodev.animeplus.bridge

import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.karlitodev.animeplus.update.UpdateChecker
import com.karlitodev.animeplus.utils.HashUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.TimeUnit

class WebAppInterface(
    activity: Activity,
    webView: WebView
) {
    private companion object {
        const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
        const val MAX_VIBRATION_MS = 2_000L
    }

    // applicationContext : ne retient pas une Activity
    private val context: Context = activity.applicationContext

    // WeakReference sur l'Activity pour setRequestedOrientation (rotation player)
    private val activityRef = WeakReference(activity)

    // WeakReference : le bridge ne maintient pas la WebView en vie après sa destruction
    private val webViewRef = WeakReference(webView)

    // Un seul scope partagé : une exception dans une tâche n'annule pas les autres
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    // Requête HTTP GET native intégrée (bypasse tout problème CORS et Cloudflare Referer)
    @JavascriptInterface
    fun httpGet(url: String, callbackId: String) {
        ioScope.launch {
            try {
                val reqBuilder = Request.Builder()
                    .url(url)
                    .header("User-Agent", USER_AGENT)
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

                // use { } ferme toujours la réponse et libère la connexion
                val body = client.newCall(reqBuilder.build()).execute().use { response ->
                    response.body?.string() ?: ""
                }
                sendHttpSuccess(callbackId, body)
            } catch (e: Exception) {
                sendHttpError(callbackId, e.message ?: "Erreur réseau native")
            }
        }
    }

    // Requête HTTP POST native (pour les recherches AJAX VoirAnime)
    @JavascriptInterface
    fun httpPost(url: String, bodyStr: String, contentType: String, callbackId: String) {
        ioScope.launch {
            try {
                val mediaType = (contentType.ifEmpty { "application/x-www-form-urlencoded" }).toMediaTypeOrNull()
                val reqBody = bodyStr.toRequestBody(mediaType)

                val reqBuilder = Request.Builder()
                    .url(url)
                    .post(reqBody)
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "*/*")

                if (url.contains("voiranime")) {
                    reqBuilder.header("Referer", "https://voiranime.be/")
                }

                val body = client.newCall(reqBuilder.build()).execute().use { response ->
                    response.body?.string() ?: ""
                }
                sendHttpSuccess(callbackId, body)
            } catch (e: Exception) {
                sendHttpError(callbackId, e.message ?: "Erreur réseau native")
            }
        }
    }

    // Vibration
    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            // Borne la durée : 0 ou négatif lève une exception, une valeur énorme bloquerait le moteur
            val safeDuration = durationMs.coerceIn(1L, MAX_VIBRATION_MS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(VibratorManager::class.java)
                manager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(safeDuration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                v?.vibrate(safeDuration)
            }
        } catch (_: Exception) {}
    }

    // Hash SHA-256 (délégué à Kotlin pour fiabilité)
    @JavascriptInterface
    fun sha256(input: String): String = HashUtils.sha256(input)

    // Vérifie les MAJ GitHub
    @JavascriptInterface
    fun checkUpdate(currentVersion: String) {
        ioScope.launch {
            // check() renvoie toujours du JSON valide, injecté tel quel comme objet JS
            val result = try {
                UpdateChecker.check(currentVersion)
            } catch (e: Exception) {
                JSONObject().put("error", e.message ?: "Erreur inconnue").toString()
            }
            runJs("window.onUpdateCheck && window.onUpdateCheck($result)")
        }
    }

    // Info OS pour le JS
    @JavascriptInterface
    fun getDeviceInfo(): String {
        // JSONObject échappe correctement les guillemets éventuels dans le modèle ou la marque
        return JSONObject()
            .put("sdk", Build.VERSION.SDK_INT)
            .put("model", Build.MODEL)
            .put("brand", Build.BRAND)
            .toString()
    }

    // Indique que l'environnement natif Android est prêt
    @JavascriptInterface
    fun isNative(): Boolean = true

    // Contrôle de l'orientation : "landscape" pour le player, "portrait" pour le reste
    @JavascriptInterface
    fun setOrientation(mode: String) {
        val activity = activityRef.get() ?: return
        activity.runOnUiThread {
            activity.requestedOrientation = when (mode) {
                "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                "portrait"  -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                else        -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
    }

    private fun sendHttpSuccess(callbackId: String, body: String) {
        runJs("window.onNativeHttpSuccess && window.onNativeHttpSuccess(${JSONObject.quote(callbackId)}, ${JSONObject.quote(body)})")
    }

    private fun sendHttpError(callbackId: String, message: String) {
        runJs("window.onNativeHttpError && window.onNativeHttpError(${JSONObject.quote(callbackId)}, ${JSONObject.quote(message)})")
    }

    // post { } s'exécute sur le main thread et ne fait rien si la WebView n'existe plus
    private fun runJs(script: String) {
        val view = webViewRef.get() ?: return
        view.post {
            try {
                view.evaluateJavascript(script, null)
            } catch (_: Exception) {
                // WebView déjà détruite : on ignore
            }
        }
    }
}