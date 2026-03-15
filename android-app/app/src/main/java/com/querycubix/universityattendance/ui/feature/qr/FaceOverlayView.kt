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
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 8f
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

    fun setFaceState(state: FaceState) {
        if (faceState != state) {
            faceState = state
            borderPaint.color = when (state) {
                FaceState.VALID -> Color.GREEN
                FaceState.INVALID -> Color.RED
                FaceState.NO_FACE -> Color.WHITE
            }
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // 1. Draw the dimmed background over the entire view
        val layerId = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        // 2. Define the face oval (centered, roughly 70% width)
        val horizontalMargin = width * 0.15f
        val verticalMargin = height * 0.25f
        ovalRect.set(
            horizontalMargin,
            verticalMargin,
            width - horizontalMargin,
            height - verticalMargin
        )

        // 3. "Punch a hole" through the background
        canvas.drawOval(ovalRect, eraserPaint)
        
        // 4. Draw the border around the hole
        canvas.drawOval(ovalRect, borderPaint)

        canvas.restoreToCount(layerId)
    }
}
