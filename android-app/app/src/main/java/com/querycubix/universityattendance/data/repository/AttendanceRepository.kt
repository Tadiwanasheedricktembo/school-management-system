package com.querycubix.universityattendance.data.repository

import com.querycubix.universityattendance.data.remote.AttendanceApiService
import com.querycubix.universityattendance.data.remote.AttendanceRequest
import com.querycubix.universityattendance.data.remote.AttendanceResponse
import retrofit2.Response

class AttendanceRepository(private val apiService: AttendanceApiService) {
    suspend fun markAttendance(
        studentName: String,
        rollNumber: String,
        token: String,
        deviceId: String,
        latitude: Double? = null,
        longitude: Double? = null,
        selfie: String? = null
    ): Response<AttendanceResponse> {
        return apiService.markAttendance(
            AttendanceRequest(
                student_name = studentName,
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
