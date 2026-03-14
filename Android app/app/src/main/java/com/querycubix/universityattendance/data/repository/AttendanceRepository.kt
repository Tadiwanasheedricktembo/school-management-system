package com.querycubix.universityattendance.data.repository

import com.querycubix.universityattendance.data.remote.AttendanceApiService
import com.querycubix.universityattendance.data.remote.AttendanceRequest
import com.querycubix.universityattendance.data.remote.AttendanceResponse
import retrofit2.Response

class AttendanceRepository(private val apiService: AttendanceApiService) {
    suspend fun markAttendance(
        rollNumber: String,
        token: String,
        deviceId: String,
        latitude: Double? = null,
        longitude: Double? = null,
        selfie: String? = null
    ): Response<AttendanceResponse> {
        // FIX: Ensure constructor parameters match the data class field names (snake_case)
        return apiService.markAttendance(
            AttendanceRequest(
                roll_number = rollNumber,
                token = token,
                device_id = deviceId,
                latitude = latitude,
                longitude = longitude,
                selfie = selfie
            )
        )
    }
}
