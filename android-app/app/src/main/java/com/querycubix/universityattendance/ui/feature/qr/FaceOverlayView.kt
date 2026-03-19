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
        color = Color.parseColor("#B3111827") // Higher opacity for focus
        style = Paint.Style.FILL
    }

    private val borderPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 12f // Tighter, cleaner stroke
        isAntiAlias = true
        setShadowLayer(20f, 0f, 0f, Color.WHITE)
    }

    private val gridPaint = Paint().apply {
        color = Color.parseColor("#30FFFFFF")
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
                FaceState.VALID -> Color.parseColor("#3B82F6") // Professional Blue
                FaceState.INVALID -> Color.parseColor("#EF4444") // Red for guidance
                FaceState.NO_FACE -> Color.WHITE
            }
            borderPaint.color = colorRes
            borderPaint.setShadowLayer(20f, 0f, 0f, colorRes)
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val layerId = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        // TIGHTER OVAL: 55% width, 40% height. Centered.
        // This forces the user to bring the camera very close to the face.
        val horizontalMargin = width * 0.225f 
        val verticalMargin = height * 0.30f
        ovalRect.set(
            horizontalMargin,
            verticalMargin,
            width - horizontalMargin,
            height - verticalMargin
        )

        canvas.drawOval(ovalRect, eraserPaint)
        
        // Draw alignment grid inside the tight oval
        drawBiometricGrid(canvas, ovalRect)

        canvas.drawOval(ovalRect, borderPaint)

        canvas.restoreToCount(layerId)
    }

    private fun drawBiometricGrid(canvas: Canvas, rect: RectF) {
        val centerX = rect.centerX()
        val centerY = rect.centerY()
        val w = rect.width()
        val h = rect.height()
        
        // Eye-line guide
        canvas.drawLine(centerX - w*0.3f, centerY - h*0.15f, centerX + w*0.3f, centerY - h*0.15f, gridPaint)
        // Nose-line guide
        canvas.drawLine(centerX, centerY - h*0.2f, centerX, centerY + h*0.2f, gridPaint)
        // Chin-line guide
        canvas.drawLine(centerX - w*0.2f, centerY + h*0.25f, centerX + w*0.2f, centerY + h*0.25f, gridPaint)
    }
}
