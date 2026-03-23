package com.querycubix.universityattendance.ui.main

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.animation.AnimationUtils
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.querycubix.universityattendance.R
import com.querycubix.universityattendance.databinding.ActivitySplashBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Use custom splash theme for the window background and status bar
        setTheme(R.style.Theme_App_Splash)
        
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        startAnimations()
        navigateToMain()
    }

    private fun startAnimations() {
        val fadeIn = AnimationUtils.loadAnimation(this, R.anim.splash_fade_in)
        
        // Animate main content
        binding.contentLayout.visibility = View.VISIBLE
        binding.contentLayout.startAnimation(fadeIn)

        // Animate footer with a slight delay
        lifecycleScope.launch {
            delay(400)
            val footerFadeIn = AnimationUtils.loadAnimation(this@SplashActivity, R.anim.splash_fade_in)
            binding.footerLayout.visibility = View.VISIBLE
            binding.footerLayout.startAnimation(footerFadeIn)
        }
    }

    private fun navigateToMain() {
        lifecycleScope.launch {
            // Splash screen duration
            delay(2500)
            
            val intent = Intent(this@SplashActivity, MainActivity::class.java)
            startActivity(intent)
            
            // Custom transition to MainActivity
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            
            finish()
        }
    }
}
