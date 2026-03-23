package com.querycubix.universityattendance.ui.feature.qr

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.animation.AlphaAnimation
import androidx.appcompat.app.AppCompatActivity
import com.querycubix.universityattendance.databinding.ActivityAboutBinding

class AboutActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAboutBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAboutBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        setupClickListeners()

        // Subtle fade-in animation
        val fadeIn = AlphaAnimation(0f, 1f)
        fadeIn.duration = 500
        binding.root.startAnimation(fadeIn)
    }

    private fun setupClickListeners() {
        binding.layoutEmail.setOnClickListener {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("mailto:tadiwanasheedricktembo@gmail.com")
                putExtra(Intent.EXTRA_SUBJECT, "Query regarding Attendance App")
            }
            startActivity(Intent.createChooser(intent, "Send Email"))
        }

        binding.layoutGithub.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/Tadiwanasheedricktembo"))
            startActivity(intent)
        }
    }
}
