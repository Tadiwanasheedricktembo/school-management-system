package com.querycubix.universityattendance.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.util.Base64
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.view.animation.ScaleAnimation
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.querycubix.universityattendance.R
import com.querycubix.universityattendance.UniversityApplication
import com.querycubix.universityattendance.data.remote.AttendanceApiService
import com.querycubix.universityattendance.data.remote.NetworkConfig
import com.querycubix.universityattendance.data.repository.AttendanceRepository
import com.querycubix.universityattendance.databinding.ActivityMainBinding
import com.querycubix.universityattendance.ui.feature.qr.AboutActivity
import com.querycubix.universityattendance.ui.feature.qr.CustomScannerActivity
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceState
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModel
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModelFactory
import com.querycubix.universityattendance.ui.feature.qr.SelfieActivity
import com.querycubix.universityattendance.ui.feature.qr.VerificationState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.ByteArrayOutputStream
import kotlin.math.abs

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: QrAttendanceViewModel
    private val app by lazy { application as UniversityApplication }
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    
    private var lastScanClickTime: Long = 0
    private var currentStep = 1
    private var pulseAnimation: Animation? = null

    private val qrScannerLauncher: ActivityResultLauncher<ScanOptions> =
        registerForActivityResult(ScanContract()) { result ->
            val token = result.contents
            val studentName = binding.etStudentName.text.toString().trim()
            val rollNumber = binding.etRollNumber.text.toString().trim()
            val deviceId = getUniqueDeviceId()
            
            if (token != null) {
                app.session.lastRollNumber = rollNumber
                viewModel.markAttendance(
                    studentName = studentName,
                    rollNumber = rollNumber,
                    token = token,
                    deviceId = deviceId,
                    latitude = viewModel.capturedLatitude,
                    longitude = viewModel.capturedLongitude,
                    selfie = viewModel.capturedSelfieBase64
                )
            } else {
                Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
            }
        }

    private val selfieLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val selfieUri = result.data?.data
            if (selfieUri != null) {
                processSelfie(selfieUri)
            }
        } else {
            if (viewModel.biometricState.value == VerificationState.PENDING) {
                viewModel.updateBiometricState(VerificationState.NOT_STARTED)
            }
        }
    }

    private fun processSelfie(uri: Uri) {
        lifecycleScope.launch {
            viewModel.updateBiometricState(VerificationState.PENDING)
            binding.pbStep2.visibility = View.VISIBLE
            
            val validationResult = withContext(Dispatchers.Default) { validateSelfieContent(uri) }
            
            if (validationResult == "OK") {
                val base64 = withContext(Dispatchers.IO) { uriToBase64(uri) }
                if (base64 != null) {
                    viewModel.capturedSelfieBase64 = base64
                    binding.ivSelfiePreview.setImageURI(uri)
                    binding.ivStep2SummaryPreview.setImageURI(uri)
                    
                    binding.cvSelfiePreview.visibility = View.VISIBLE
                    fadeIn(binding.cvSelfiePreview)
                    
                    viewModel.updateBiometricState(VerificationState.VERIFIED)
                } else {
                    viewModel.updateBiometricState(VerificationState.FAILED)
                    Toast.makeText(this@MainActivity, "Error processing image", Toast.LENGTH_SHORT).show()
                }
            } else {
                viewModel.updateBiometricState(VerificationState.FAILED)
                Toast.makeText(this@MainActivity, validationResult, Toast.LENGTH_LONG).show()
            }
            binding.pbStep2.visibility = View.GONE
        }
    }

    private suspend fun validateSelfieContent(uri: Uri): String {
        return try {
            val image = InputImage.fromFilePath(this, uri)
            val options = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .build()
            
            val detector = FaceDetection.getClient(options)
            val faces = detector.process(image).await()

            if (faces.isEmpty()) return "No face detected. Please retake."
            if (faces.size > 1) return "Multiple faces detected."

            val face = faces[0]
            if (abs(face.headEulerAngleY) > 15 || abs(face.headEulerAngleX) > 15) return "Look directly at the camera."

            val sizeRatio = face.boundingBox.width().toFloat() / image.width.toFloat()
            if (sizeRatio < 0.20) return "Face too far away."

            "OK"
        } catch (e: Exception) {
            "Error validating selfie."
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false)) {
            fetchLocation()
        } else {
            viewModel.updateLocationState(VerificationState.FAILED)
            Toast.makeText(this, "Location permission required", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setSupportActionBar(null) 
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        setupViewModel()
        setupUI()
        setupListeners()
        observeViewModel()
        setStep(1)
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_about) {
            startActivity(Intent(this, AboutActivity::class.java))
            return true
        }
        return super.onOptionsItemSelected(item)
    }

    private fun setupUI() {
        binding.etRollNumber.setText(app.session.lastRollNumber)
        
        val commonTextWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { 
                if (currentStep > 1) {
                    viewModel.updateBiometricState(VerificationState.NOT_STARTED)
                    viewModel.updateLocationState(VerificationState.NOT_STARTED)
                    setStep(1)
                }
                updateReadinessUI() 
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        binding.etStudentName.addTextChangedListener(commonTextWatcher)
        binding.etRollNumber.addTextChangedListener(commonTextWatcher)
    }

    private fun setStep(step: Int) {
        val oldStep = currentStep
        currentStep = step
        
        if (step == 1) {
            binding.layoutStep1Content.visibility = View.VISIBLE
            binding.layoutStep1Summary.visibility = View.GONE
            binding.ivStep1Check.visibility = View.GONE
        } else {
            binding.layoutStep1Content.visibility = View.GONE
            binding.layoutStep1Summary.visibility = View.VISIBLE
            binding.ivStep1Check.visibility = View.VISIBLE
            if (oldStep == 1) {
                fadeIn(binding.layoutStep1Summary)
                scaleUp(binding.ivStep1Check)
            }
        }
        
        binding.cardStep2.alpha = if (step >= 2) 1.0f else 0.5f
        binding.cardStep3.alpha = if (step >= 3) 1.0f else 0.5f
        
        updateStepIndicators(step)

        binding.tvStep1SummaryName.text = binding.etStudentName.text.toString().trim()
        binding.tvStep1SummaryRoll.text = binding.etRollNumber.text.toString().trim()
    }

    private fun updateStepIndicators(step: Int) {
        val activeColor = ContextCompat.getColor(this, R.color.primary)
        val inactiveColor = ContextCompat.getColor(this, R.color.border_default)
        val textTertiary = ContextCompat.getColor(this, R.color.text_tertiary)

        binding.indicatorStep1.setBackgroundColor(if (step >= 1) activeColor else inactiveColor)
        binding.indicatorStep2.setBackgroundColor(if (step >= 2) activeColor else inactiveColor)
        binding.indicatorStep3.setBackgroundColor(if (step >= 3) activeColor else inactiveColor)
        binding.indicatorStep4.setBackgroundColor(if (step >= 4) activeColor else inactiveColor)

        // Find labels (children of parent LinearLayout of indicators)
        val parent = binding.indicatorStep1.parent as android.widget.LinearLayout
        val label = parent.getChildAt(1) as? TextView
        label?.setTextColor(if (step >= 1) activeColor else textTertiary)
        
        (binding.indicatorStep2.parent as android.widget.LinearLayout).getChildAt(1).let {
            if (it is TextView) it.setTextColor(if (step >= 2) activeColor else textTertiary)
        }
        (binding.indicatorStep3.parent as android.widget.LinearLayout).getChildAt(1).let {
            if (it is TextView) it.setTextColor(if (step >= 3) activeColor else textTertiary)
        }
        (binding.indicatorStep4.parent as android.widget.LinearLayout).getChildAt(1).let {
            if (it is TextView) it.setTextColor(if (step >= 4) activeColor else textTertiary)
        }
    }

    private fun isLocationEnabled(): Boolean {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
               locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    private fun updateReadinessUI() {
        val hasName = binding.etStudentName.text.toString().trim().isNotEmpty()
        val hasRoll = binding.etRollNumber.text.toString().trim().isNotEmpty()
        val biometricVerified = viewModel.biometricState.value == VerificationState.VERIFIED
        val locationVerified = viewModel.locationState.value == VerificationState.VERIFIED

        val isReady = hasName && hasRoll && biometricVerified && locationVerified
        binding.btnScanQr.isEnabled = isReady
        
        if (isReady) {
            binding.tvScanHelper.visibility = View.GONE
            binding.layoutStatusBadge.visibility = View.VISIBLE
            fadeIn(binding.layoutStatusBadge)
            startPulseAnimation(binding.btnScanQr)
        } else {
            binding.layoutStatusBadge.visibility = View.GONE
            binding.tvScanHelper.visibility = View.VISIBLE
            
            val pending = mutableListOf<String>()
            if (!hasName || !hasRoll) pending.add("Info")
            if (!biometricVerified) pending.add("Face")
            if (!locationVerified) pending.add("Location")
            
            binding.tvScanHelper.text = "Required: ${pending.joinToString(", ")}"
            stopPulseAnimation(binding.btnScanQr)
        }
    }

    private fun setupListeners() {
        binding.btnAbout.setOnClickListener {
            startActivity(Intent(this, AboutActivity::class.java))
        }

        binding.btnStep1Continue.setOnClickListener {
            val name = binding.etStudentName.text.toString().trim()
            val roll = binding.etRollNumber.text.toString().trim()
            
            if (name.isEmpty()) {
                binding.etStudentName.error = "Name is required"
                return@setOnClickListener
            }
            if (roll.isEmpty()) {
                binding.etRollNumber.error = "Roll number is required"
                return@setOnClickListener
            }
            
            setStep(2)
        }

        binding.layoutStep1Summary.setOnClickListener {
            setStep(1)
        }

        binding.btnTakeSelfie.setOnClickListener {
            val intent = Intent(this, SelfieActivity::class.java)
            selfieLauncher.launch(intent)
        }

        binding.btnGetLocation.setOnClickListener {
            if (!isLocationEnabled()) {
                Toast.makeText(this, "Please enable GPS/Location services", Toast.LENGTH_LONG).show()
                startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                return@setOnClickListener
            }
            
            viewModel.updateLocationState(VerificationState.PENDING)
            checkLocationPermission()
        }

        binding.btnScanQr.setOnClickListener {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastScanClickTime < 2000) return@setOnClickListener
            lastScanClickTime = currentTime

            val options = ScanOptions()
            options.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            options.setPrompt("Scan Attendance QR Code")
            options.setCameraId(0)
            options.setBeepEnabled(true)
            options.setBarcodeImageEnabled(true)
            options.setOrientationLocked(false)
            options.setCaptureActivity(CustomScannerActivity::class.java)
            
            qrScannerLauncher.launch(options)
        }
    }

    private fun checkLocationPermission() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED -> {
                fetchLocation()
            }
            else -> {
                locationPermissionLauncher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ))
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun fetchLocation() {
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                viewModel.capturedLatitude = location.latitude
                viewModel.capturedLongitude = location.longitude
                viewModel.updateLocationState(VerificationState.VERIFIED)
            } else {
                viewModel.updateLocationState(VerificationState.FAILED)
                Toast.makeText(this, "Could not get location. Try moving outdoors.", Toast.LENGTH_LONG).show()
            }
        }.addOnFailureListener {
            viewModel.updateLocationState(VerificationState.FAILED)
            Toast.makeText(this, "Location error: ${it.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupViewModel() {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
        val client = okhttp3.OkHttpClient.Builder().addInterceptor(logging).build()
        val retrofit = Retrofit.Builder()
            .baseUrl(NetworkConfig.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val apiService = retrofit.create(AttendanceApiService::class.java)
        val repository = AttendanceRepository(apiService)
        val factory = QrAttendanceViewModelFactory(repository)
        viewModel = ViewModelProvider(this, factory)[QrAttendanceViewModel::class.java]
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collectLatest { state ->
                    when (state) {
                        is QrAttendanceState.Loading -> {
                            binding.btnScanQr.isEnabled = false
                            binding.progressBar.visibility = View.VISIBLE
                            binding.tvStatus.visibility = View.VISIBLE
                            binding.tvStatus.text = "Processing..."
                        }
                        is QrAttendanceState.Success -> {
                            binding.progressBar.visibility = View.GONE
                            binding.tvStatus.visibility = View.GONE
                            Toast.makeText(this@MainActivity, state.message, Toast.LENGTH_LONG).show()
                            resetForm()
                        }
                        is QrAttendanceState.Error -> {
                            binding.progressBar.visibility = View.GONE
                            binding.tvStatus.visibility = View.VISIBLE
                            binding.tvStatus.text = state.message
                            binding.tvStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.error))
                            binding.btnScanQr.isEnabled = true
                        }
                        else -> {
                            binding.progressBar.visibility = View.GONE
                            binding.tvStatus.visibility = View.GONE
                        }
                    }
                }
            }
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.biometricState.collectLatest { state ->
                    updateVerificationUI(binding.tvStep2Subtitle, binding.ivStep2StateIcon, state)
                    if (state == VerificationState.VERIFIED && currentStep == 2) {
                        setStep(3)
                        binding.layoutStep2Content.visibility = View.GONE
                        binding.layoutStep2Summary.visibility = View.VISIBLE
                        fadeIn(binding.layoutStep2Summary)
                        scaleUp(binding.ivStep2Check)
                    }
                    updateReadinessUI()
                }
            }
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.locationState.collectLatest { state ->
                    updateVerificationUI(binding.tvStep3Subtitle, binding.ivStep3StateIcon, state)
                    if (state == VerificationState.VERIFIED && currentStep == 3) {
                        setStep(4)
                        binding.layoutStep3Content.visibility = View.GONE
                        binding.layoutStep3Summary.visibility = View.VISIBLE
                        fadeIn(binding.layoutStep3Summary)
                        scaleUp(binding.ivStep3Check)
                    }
                    updateReadinessUI()
                }
            }
        }
    }

    private fun updateVerificationUI(textView: android.widget.TextView, iconView: android.widget.ImageView, state: VerificationState) {
        when (state) {
            VerificationState.NOT_STARTED -> {
                textView.text = "Action Required"
                textView.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
                iconView.setImageResource(android.R.drawable.ic_secure)
                iconView.alpha = 0.3f
                iconView.clearAnimation()
            }
            VerificationState.PENDING -> {
                textView.text = "Verifying..."
                textView.setTextColor(ContextCompat.getColor(this, R.color.info))
                iconView.alpha = 1.0f
                startRotateAnimation(iconView)
            }
            VerificationState.VERIFIED -> {
                textView.text = "Identity Confirmed"
                textView.setTextColor(ContextCompat.getColor(this, R.color.success))
                iconView.setImageResource(R.drawable.ic_check_circle)
                iconView.alpha = 1.0f
                iconView.clearAnimation()
                scaleUp(iconView)
            }
            VerificationState.FAILED -> {
                textView.text = "Check Failed"
                textView.setTextColor(ContextCompat.getColor(this, R.color.error))
                iconView.alpha = 1.0f
                iconView.clearAnimation()
            }
        }
    }

    private fun resetForm() {
        binding.etStudentName.text?.clear()
        binding.etRollNumber.text?.clear()
        viewModel.resetState()
        binding.cvSelfiePreview.visibility = View.GONE
        setStep(1)
    }

    private fun getUniqueDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
    }

    private fun uriToBase64(uri: Uri): String? {
        return try {
            val inputStream = contentResolver.openInputStream(uri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
            Base64.encodeToString(outputStream.toByteArray(), Base64.DEFAULT)
        } catch (e: Exception) {
            null
        }
    }

    private fun fadeIn(view: View) {
        val anim = AlphaAnimation(0f, 1f)
        anim.duration = 400
        view.startAnimation(anim)
    }

    private fun scaleUp(view: View) {
        val anim = ScaleAnimation(0.8f, 1f, 0.8f, 1f, Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f)
        anim.duration = 300
        view.startAnimation(anim)
    }

    private fun startRotateAnimation(view: View) {
        view.animate().rotationBy(360f).setDuration(1000).withEndAction {
            if (viewModel.biometricState.value == VerificationState.PENDING || 
                viewModel.locationState.value == VerificationState.PENDING) {
                startRotateAnimation(view)
            }
        }.start()
    }

    private fun startPulseAnimation(view: View) {
        if (pulseAnimation == null) {
            pulseAnimation = ScaleAnimation(1f, 1.02f, 1f, 1.02f, Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f)
            pulseAnimation?.duration = 800
            pulseAnimation?.repeatMode = Animation.REVERSE
            pulseAnimation?.repeatCount = Animation.INFINITE
        }
        view.startAnimation(pulseAnimation)
    }

    private fun stopPulseAnimation(view: View) {
        view.clearAnimation()
    }
}
