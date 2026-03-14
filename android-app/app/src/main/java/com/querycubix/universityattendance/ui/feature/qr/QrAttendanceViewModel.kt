package com.querycubix.universityattendance.ui.feature.qr

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.querycubix.universityattendance.data.remote.AttendanceRequest
import com.querycubix.universityattendance.data.repository.AttendanceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class QrAttendanceState {
    object Idle : QrAttendanceState()
    object Loading : QrAttendanceState()
    data class Success(val message: String) : QrAttendanceState()
    data class Error(val message: String) : QrAttendanceState()
}

class QrAttendanceViewModel(
    private val repository: AttendanceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<QrAttendanceState>(QrAttendanceState.Idle)
    val uiState: StateFlow<QrAttendanceState> = _uiState.asStateFlow()

    // Persistent state to survive Activity recreation
    var capturedLatitude: Double? = null
    var capturedLongitude: Double? = null
    var capturedSelfieBase64: String? = null

    fun markAttendance(
        rollNumber: String,
        token: String,
        deviceId: String,
        latitude: Double?,
        longitude: Double?,
        selfie: String?
    ) {
        viewModelScope.launch {
            // Building the request object to log exactly what's being sent
            val request = AttendanceRequest(
                roll_number = rollNumber,
                token = token,
                device_id = deviceId,
                latitude = latitude,
                longitude = longitude,
                selfie = selfie
            )

            Log.d("ATTENDANCE_LOG", "--- PRE-SUBMISSION DEBUG ---")
            Log.d("ATTENDANCE_LOG", "Roll: $rollNumber")
            Log.d("ATTENDANCE_LOG", "Token: $token")
            Log.d("ATTENDANCE_LOG", "Device ID: $deviceId")
            Log.d("ATTENDANCE_LOG", "Latitude: ${latitude ?: "NULL"}")
            Log.d("ATTENDANCE_LOG", "Longitude: ${longitude ?: "NULL"}")
            Log.d("ATTENDANCE_LOG", "Selfie (Base64 length): ${selfie?.length ?: 0}")
            Log.d("ATTENDANCE_LOG", "FULL JSON PAYLOAD: ${Gson().toJson(request)}")
            
            _uiState.value = QrAttendanceState.Loading
            try {
                val response = repository.markAttendance(
                    rollNumber = rollNumber,
                    token = token,
                    deviceId = deviceId,
                    latitude = latitude,
                    longitude = longitude,
                    selfie = selfie
                )
                
                val body = response.body()
                Log.d("ATTENDANCE_LOG", "--- BACKEND RESPONSE ---")
                Log.d("ATTENDANCE_LOG", "Status Code: ${response.code()}")
                Log.d("ATTENDANCE_LOG", "Response Body: ${Gson().toJson(body)}")

                if (response.isSuccessful && body != null) {
                    if (body.success) {
                        _uiState.value = QrAttendanceState.Success(body.message)
                    } else {
                        _uiState.value = QrAttendanceState.Error(body.message)
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Unknown Server Error"
                    Log.d("ATTENDANCE_LOG", "HTTP Error: $errorMsg")
                    _uiState.value = QrAttendanceState.Error(errorMsg)
                }
            } catch (e: Exception) {
                Log.e("ATTENDANCE_LOG", "Exception during request", e)
                _uiState.value = QrAttendanceState.Error("Network Error: ${e.message}")
            }
        }
    }

    fun resetState() {
        _uiState.value = QrAttendanceState.Idle
        capturedLatitude = null
        capturedLongitude = null
        capturedSelfieBase64 = null
    }
}

class QrAttendanceViewModelFactory(
    private val repository: AttendanceRepository
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(QrAttendanceViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return QrAttendanceViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
