package com.querycubix.universityattendance.ui.feature.attendance

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.querycubix.universityattendance.data.model.Attendance
import com.querycubix.universityattendance.databinding.ItemAttendanceBinding
import java.text.SimpleDateFormat
import java.util.*

class AttendanceAdapter(
    private val onEditClick: (Attendance) -> Unit,
    private val onDeleteClick: (Attendance) -> Unit
) : ListAdapter<Attendance, AttendanceAdapter.AttendanceViewHolder>(AttendanceDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AttendanceViewHolder {
        val binding = ItemAttendanceBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AttendanceViewHolder(binding)
    }

    override fun onBindViewHolder(holder: AttendanceViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class AttendanceViewHolder(private val binding: ItemAttendanceBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(attendance: Attendance) {
            binding.tvCourseCode.text = attendance.courseCode
            binding.tvDate.text = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
                .format(Date(attendance.date))
            binding.tvStatus.text = attendance.status

            binding.root.setOnClickListener { onEditClick(attendance) }
            binding.root.setOnLongClickListener {
                onDeleteClick(attendance)
                true
            }
        }
    }

    class AttendanceDiffCallback : DiffUtil.ItemCallback<Attendance>() {
        override fun areItemsTheSame(oldItem: Attendance, newItem: Attendance): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Attendance, newItem: Attendance): Boolean {
            return oldItem == newItem
        }
    }
}
