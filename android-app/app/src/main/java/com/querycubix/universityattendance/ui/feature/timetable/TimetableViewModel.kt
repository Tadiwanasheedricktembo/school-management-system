package com.querycubix.universityattendance.ui.feature.timetable

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.querycubix.universityattendance.data.model.Course
import com.querycubix.universityattendance.data.model.TimetableEntry
import com.querycubix.universityattendance.data.repository.UniversityRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class TimetableUiState(
    val timetableList: List<TimetableEntry> = emptyList(),
    val courses: List<Course> = emptyList(),
    val isLoading: Boolean = false
)

class TimetableViewModel(
    private val repository: UniversityRepository,
    private val studentId: String
) : ViewModel() {

    private val _uiState = MutableStateFlow(TimetableUiState(isLoading = true))
    val uiState: StateFlow<TimetableUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            combine(
                repository.getTimetableForStudent(studentId),
                repository.getCourses()
            ) { timetable, courses ->
                TimetableUiState(
                    timetableList = timetable,
                    courses = courses,
                    isLoading = false
                )
            }.collect { newState ->
                _uiState.value = newState
            }
        }
    }

    fun addTimetableEntry(entry: TimetableEntry) {
        viewModelScope.launch {
            repository.insertTimetableEntry(entry)
        }
    }

    fun updateTimetableEntry(entry: TimetableEntry) {
        viewModelScope.launch {
            repository.updateTimetableEntry(entry)
        }
    }

    fun deleteTimetableEntry(entry: TimetableEntry) {
        viewModelScope.launch {
            repository.deleteTimetableEntry(entry)
        }
    }
}

class TimetableViewModelFactory(
    private val repository: UniversityRepository,
    private val studentId: String
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(TimetableViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return TimetableViewModel(repository, studentId) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
