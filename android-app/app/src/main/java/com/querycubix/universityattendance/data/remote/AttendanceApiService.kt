package com.querycubix.universityattendance.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

data class AttendanceRequest(
    @SerializedName("student_name")
    val student_name: String,

    @SerializedName("roll_number")
    val roll_number: String,
    
    @SerializedName("token")
    val token: String,
    
    @SerializedName("device_id")
    val device_id: String,
    
    @SerializedName("latitude")
    val latitude: Double? = null,
    
    @SerializedName("longitude")
    val longitude: Double? = null,
    
    @SerializedName("selfie")
    val selfie: String? = null
)

data class AttendanceResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String
)

interface AttendanceApiService {
    @POST("attendance/mark")
    suspend fun markAttendance(@Body request: AttendanceRequest): Response<AttendanceResponse>
}
