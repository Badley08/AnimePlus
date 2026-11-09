package com.karlitodev.animeplus.bridge

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.content.getSystemService
import com.karlitodev.animeplus.update.UpdateChecker
import com.karlitodev.animeplus.utils.HashUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WebAppInterface(
    private val context: Context,
    private val webView: WebView
) {
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

    // Désactiver long press depuis le JS (appelé après init)
    @JavascriptInterface
    fun isNative(): Boolean = true
}

