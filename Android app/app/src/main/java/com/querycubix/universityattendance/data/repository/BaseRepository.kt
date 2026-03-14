package com.querycubix.universityattendance.data.repository

import com.querycubix.universityattendance.data.UiState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

abstract class BaseRepository {
    protected fun <T> mokedFlow(data: T): Flow<UiState<T>> = flow {
        emit(UiState.Loading)
        kotlinx.coroutines.delay(500)
        emit(UiState.Success(data))
    }
}