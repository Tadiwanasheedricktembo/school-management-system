package com.querycubix.universityattendance.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.querycubix.universityattendance.data.UiState
import com.querycubix.universityattendance.data.model.Student
import com.querycubix.universityattendance.data.repository.UniversityRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class DashboardViewModel(private val repository: UniversityRepository) : ViewModel() {
    private val _studentState = MutableStateFlow<UiState<Student>>(UiState.Loading)
    val studentState: StateFlow<UiState<Student>> = _studentState

    init {
        loadStudentData()
    }

    private fun loadStudentData() {
        viewModelScope.launch {
            _studentState.value = UiState.Loading
            // In next stage, this will be fetched from repository
            delay(1000)
            _studentState.value = UiState.Success(
                Student(
                    regNo = "24/SCA/BSc(IT)/010",
                    name = "Tembo Tadiwanashe E",
                    prn = "2026-CS-001",
                    admissionNo = "ADM-2024-001",
                    currentSemester = 4
                )
            )
        }
    }
}
