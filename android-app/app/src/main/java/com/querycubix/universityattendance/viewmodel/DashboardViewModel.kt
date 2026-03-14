package com.querycubix.universityattendance.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.querycubix.universityattendance.data.UiState
import com.querycubix.universityattendance.data.model.Student
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class DashboardViewModel : ViewModel() {
    private val _studentState = MutableStateFlow<UiState<Student>>(UiState.Loading)
    val studentState: StateFlow<UiState<Student>> = _studentState

    init {
        loadStudentData()
    }

    private fun loadStudentData() {
        viewModelScope.launch {
            _studentState.value = UiState.Loading
            // Mocking data for now as per requirements
            kotlinx.coroutines.delay(1000)
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