package com.querycubix.universityattendance.ui.feature.qr

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.querycubix.universityattendance.R

class FaceOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val backgroundPaint = Paint().apply {
        color = Color.parseColor("#99000000") // Semi-transparent black
        style = Paint.Style.FILL
    }

    private val borderPaint = Paint().apply {
        color = ContextCompat.getColor(context, R.color.primary)
        style = Paint.Style.STROKE
        strokeWidth = 8f
        isAntiAlias = true
    }

    private val gridPaint = Paint().apply {
        color = Color.parseColor("#40FFFFFF")
        style = Paint.Style.STROKE
        strokeWidth = 2f
        isAntiAlias = true
    }

    private val eraserPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
        isAntiAlias = true
    }

    private val ovalRect = RectF()
    private var faceState: FaceState = FaceState.NO_FACE

    enum class FaceState {
        NO_FACE,
        INVALID,
        VALID
    }

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }

    fun setFaceState(state: FaceState) {
        if (faceState != state) {
            faceState = state
            val colorRes = when (state) {
                FaceState.VALID -> ContextCompat.getColor(context, R.color.success)
                FaceState.INVALID -> ContextCompat.getColor(context, R.color.error)
                FaceState.NO_FACE -> ContextCompat.getColor(context, R.color.primary)
            }
            borderPaint.color = colorRes
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val layerId = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        
        // Draw the dark background
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        // Calculate oval size (centered)
        val ovalWidth = width * 0.7f
        val ovalHeight = ovalWidth * 1.3f
        val left = (width - ovalWidth) / 2
        val top = (height - ovalHeight) / 2 - (height * 0.05f) // Slightly above center
        
        ovalRect.set(left, top, left + ovalWidth, top + ovalHeight)

        // Punch a hole in the background
        canvas.drawOval(ovalRect, eraserPaint)
        
        // Draw biometric-style grid lines
        drawBiometricGrid(canvas, ovalRect)

        // Draw the oval border
        canvas.drawOval(ovalRect, borderPaint)

        canvas.restoreToCount(layerId)
    }

    private fun drawBiometricGrid(canvas: Canvas, rect: RectF) {
        val centerX = rect.centerX()
        val centerY = rect.centerY()
        val w = rect.width()
        val h = rect.height()
        
        // Eye-line guide
        canvas.drawLine(rect.left + w*0.2f, centerY - h*0.15f, rect.right - w*0.2f, centerY - h*0.15f, gridPaint)
        // Vertical center line
        canvas.drawLine(centerX, rect.top + h*0.1f, centerX, rect.bottom - h*0.1f, gridPaint)
    }
}
