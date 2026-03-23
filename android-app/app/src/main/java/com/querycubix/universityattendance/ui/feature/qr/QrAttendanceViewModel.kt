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

enum class VerificationState { NOT_STARTED, PENDING, VERIFIED, FAILED }

class QrAttendanceViewModel(
    private val repository: AttendanceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<QrAttendanceState>(QrAttendanceState.Idle)
    val uiState: StateFlow<QrAttendanceState> = _uiState.asStateFlow()

    private val _biometricState = MutableStateFlow(VerificationState.NOT_STARTED)
    val biometricState: StateFlow<VerificationState> = _biometricState.asStateFlow()

    private val _locationState = MutableStateFlow(VerificationState.NOT_STARTED)
    val locationState: StateFlow<VerificationState> = _locationState.asStateFlow()

    var capturedLatitude: Double? = null
    var capturedLongitude: Double? = null
    var capturedSelfieBase64: String? = null

    fun updateBiometricState(state: VerificationState) {
        _biometricState.value = state
        if (state != VerificationState.VERIFIED) {
            capturedSelfieBase64 = null
        }
    }

    fun updateLocationState(state: VerificationState) {
        _locationState.value = state
        if (state != VerificationState.VERIFIED) {
            capturedLatitude = null
            capturedLongitude = null
        }
    }

    fun markAttendance(
        studentName: String,
        rollNumber: String,
        token: String,
        deviceId: String,
        latitude: Double?,
        longitude: Double?,
        selfie: String?
    ) {
        viewModelScope.launch {
            _uiState.value = QrAttendanceState.Loading
            try {
                val response = repository.markAttendance(
                    studentName = studentName,
                    rollNumber = rollNumber,
                    token = token,
                    deviceId = deviceId,
                    latitude = latitude,
                    longitude = longitude,
                    selfie = selfie
                )
                
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    if (body.success) {
                        _uiState.value = QrAttendanceState.Success(body.message)
                    } else {
                        _uiState.value = QrAttendanceState.Error(body.message)
                    }
                } else {
                    _uiState.value = QrAttendanceState.Error(response.errorBody()?.string() ?: "Unknown Server Error")
                }
            } catch (e: Exception) {
                _uiState.value = QrAttendanceState.Error("Network Error: ${e.message}")
            }
        }
    }

    fun resetState() {
        _uiState.value = QrAttendanceState.Idle
        _biometricState.value = VerificationState.NOT_STARTED
        _locationState.value = VerificationState.NOT_STARTED
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
