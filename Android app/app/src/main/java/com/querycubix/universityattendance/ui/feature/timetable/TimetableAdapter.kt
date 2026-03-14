package com.querycubix.universityattendance.ui.feature.timetable

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.querycubix.universityattendance.data.model.TimetableEntry
import com.querycubix.universityattendance.databinding.ItemTimetableBinding

class TimetableAdapter(
    private val onEditClick: (TimetableEntry) -> Unit,
    private val onDeleteClick: (TimetableEntry) -> Unit
) : ListAdapter<TimetableEntry, TimetableAdapter.TimetableViewHolder>(TimetableDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TimetableViewHolder {
        val binding = ItemTimetableBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TimetableViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TimetableViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class TimetableViewHolder(private val binding: ItemTimetableBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(entry: TimetableEntry) {
            binding.tvTime.text = "${entry.startTime} - ${entry.endTime}"
            binding.tvCourseCode.text = entry.courseCode
            binding.tvProfessor.text = entry.professor
            binding.tvRoom.text = entry.room
            binding.tvDay.text = getDayName(entry.dayOfWeek)

            binding.root.setOnClickListener { onEditClick(entry) }
            binding.root.setOnLongClickListener {
                onDeleteClick(entry)
                true
            }
        }

        private fun getDayName(day: Int): String {
            return when (day) {
                1 -> "Monday"
                2 -> "Tuesday"
                3 -> "Wednesday"
                4 -> "Thursday"
                5 -> "Friday"
                6 -> "Saturday"
                7 -> "Sunday"
                else -> ""
            }
        }
    }

    class TimetableDiffCallback : DiffUtil.ItemCallback<TimetableEntry>() {
        override fun areItemsTheSame(oldItem: TimetableEntry, newItem: TimetableEntry): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: TimetableEntry, newItem: TimetableEntry): Boolean {
            return oldItem == newItem
        }
    }
}
