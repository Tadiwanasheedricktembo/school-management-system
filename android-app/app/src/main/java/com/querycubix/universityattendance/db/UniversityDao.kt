package com.querycubix.universityattendance.db

import androidx.room.*
import com.querycubix.universityattendance.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface UniversityDao {
    // Student
    @Query("SELECT * FROM students WHERE regNo = :regNo")
    fun getStudent(regNo: String): Flow<Student?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStudent(student: Student)

    // Attendance
    @Query("SELECT * FROM attendance_logs WHERE studentRegNo = :regNo")
    fun getAttendanceForStudent(regNo: String): Flow<List<AttendanceLog>>

    // Fees
    @Query("SELECT * FROM fees WHERE studentRegNo = :regNo")
    fun getFeesForStudent(regNo: String): Flow<List<Fee>>

    @Query("SELECT SUM(amountDue - amountPaid) FROM fees WHERE studentRegNo = :regNo")
    fun getTotalOutstandingAmount(regNo: String): Flow<Double?>

    // Assignments
    @Query("SELECT * FROM assignments WHERE isSubmitted = :isSubmitted")
    fun getAssignmentsByStatus(isSubmitted: Boolean): Flow<List<Assignment>>

    @Update
    suspend fun updateAssignment(assignment: Assignment)

    // Timetable
    @Query("SELECT * FROM timetable_slots WHERE dayOfWeek = :day ORDER BY startTime ASC")
    fun getTimeTableForDay(day: Int): Flow<List<TimeTableSlot>>
}