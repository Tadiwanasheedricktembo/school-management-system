package com.querycubix.universityattendance

import com.querycubix.universityattendance.db.UniversityDao
import com.querycubix.universityattendance.model.*
import kotlinx.coroutines.flow.Flow

class UniversityRepository(private val universityDao: UniversityDao) {

    // Student profile
    fun getStudent(regNo: String): Flow<Student?> = universityDao.getStudent(regNo)

    // Attendance
    fun getAttendanceForStudent(regNo: String): Flow<List<AttendanceLog>> = 
        universityDao.getAttendanceForStudent(regNo)

    // Finance
    fun getFeesForStudent(regNo: String): Flow<List<Fee>> = 
        universityDao.getFeesForStudent(regNo)

    fun getTotalOutstanding(regNo: String): Flow<Double?> = 
        universityDao.getTotalOutstandingAmount(regNo)

    // Timetable
    fun getTimetableForDay(day: Int): Flow<List<TimeTableSlot>> = 
        universityDao.getTimeTableForDay(day)

    // Helper to insert initial data (for MVP demo)
    suspend fun insertStudent(student: Student) = universityDao.insertStudent(student)
}
