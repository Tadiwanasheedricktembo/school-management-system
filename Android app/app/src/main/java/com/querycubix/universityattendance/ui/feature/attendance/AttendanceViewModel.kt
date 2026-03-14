package com.querycubix.universityattendance.ui.feature.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.querycubix.universityattendance.data.model.Attendance
import com.querycubix.universityattendance.data.repository.UniversityRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class AttendanceUiState(
    val attendanceList: List<Attendance> = emptyList(),
    val attendancePercentage: Double = 0.0,
    val presentCount: Int = 0,
    val totalCount: Int = 0,
    val isLoading: Boolean = false
)

class AttendanceViewModel(
    private val repository: UniversityRepository,
    private val studentId: String
) : ViewModel() {

    private val _uiState = MutableStateFlow(AttendanceUiState(isLoading = true))
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    init {
        loadAttendance()
    }

    private fun loadAttendance() {
        viewModelScope.launch {
            repository.getAttendance(studentId)
                .onEach { list ->
                    val present = list.count { it.status == "Present" }
                    val total = list.size
                    val percentage = if (total > 0) (present.toDouble() / total * 100) else 0.0
                    
                    _uiState.update { 
                        it.copy(
                            attendanceList = list.sortedByDescending { att -> att.date },
                            attendancePercentage = percentage,
                            presentCount = present,
                            totalCount = total,
                            isLoading = false
                        )
                    }
                }
                .collect()
        }
    }

    fun addAttendance(courseCode: String, status: String, date: Long = System.currentTimeMillis()) {
        viewModelScope.launch {
            val newAttendance = Attendance(
                studentRegNo = studentId,
                courseCode = courseCode,
                date = date,
                status = status
            )
            repository.insertAttendance(newAttendance)
        }
    }

    fun updateAttendance(attendance: Attendance) {
        viewModelScope.launch {
            repository.updateAttendance(attendance)
        }
    }

    fun deleteAttendance(attendance: Attendance) {
        viewModelScope.launch {
            repository.deleteAttendance(attendance)
        }
    }
}

class AttendanceViewModelFactory(
    private val repository: UniversityRepository,
    private val studentId: String
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AttendanceViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AttendanceViewModel(repository, studentId) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
