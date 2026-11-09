package com.karlitodev.animeplus.utils

import java.security.MessageDigest

object HashUtils {

    private const val HEX_CHARS = "0123456789abcdef"

    fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return toHex(hashBytes)
    }

    // Plus rapide que "%02x".format(it) : pas de String.format ni d'allocation par octet
    private fun toHex(bytes: ByteArray): String {
        val result = CharArray(bytes.size * 2)
        for (i in bytes.indices) {
            val v = bytes[i].toInt() and 0xFF
            result[i * 2] = HEX_CHARS[v ushr 4]
            result[i * 2 + 1] = HEX_CHARS[v and 0x0F]
        }
        return String(result)
    }
}