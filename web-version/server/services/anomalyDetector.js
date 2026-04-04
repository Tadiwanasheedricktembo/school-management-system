const path = require('path');

class AnomalyDetector {
  // Haversine formula to calculate distance between two GPS coordinates
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers

    return distance * 1000; // Convert to meters
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Check if GPS accuracy is poor (above threshold)
  static isPoorGpsAccuracy(gpsAccuracy) {
    if (!gpsAccuracy || gpsAccuracy === '') return false;
    const accuracy = parseFloat(gpsAccuracy);
    return isNaN(accuracy) || accuracy > 50; // 50 meters threshold
  }

  // Check if selfie is missing or invalid
  static isSelfieInvalid(selfie) {
    return !selfie || selfie.trim() === '' || selfie === 'null' || selfie === 'undefined';
  }

  // Check if scan time is outside session time window
  static isOutsideSessionTime(scanTime, sessionStart, sessionEnd, sessionDate) {
    if (!scanTime || !sessionStart || !sessionEnd || !sessionDate) return false;

    try {
      const scanDateTime = new Date(scanTime);
      const sessionDateObj = new Date(sessionDate);

      // Create session start and end Date objects
      const [startHour, startMin] = sessionStart.split(':').map(Number);
      const [endHour, endMin] = sessionEnd.split(':').map(Number);

      const sessionStartTime = new Date(sessionDateObj);
      sessionStartTime.setHours(startHour, startMin, 0, 0);

      const sessionEndTime = new Date(sessionDateObj);
      sessionEndTime.setHours(endHour, endMin, 0, 0);

      return scanDateTime < sessionStartTime || scanDateTime > sessionEndTime;
    } catch (error) {
      console.warn('[ANOMALY_DETECTOR] Error checking session time:', error.message);
      return false;
    }
  }

  // Detect anomalies for an attendance record
  static detectAnomalies(attendanceData, sessionData) {
    const anomalies = [];
    let score = 0;

    const {
      latitude,
      longitude,
      gps_accuracy,
      device_id,
      selfie,
      scan_time,
      roll_number,
      session_id
    } = attendanceData;

    const {
      class_latitude,
      class_longitude,
      allowed_radius_meters,
      start_time,
      end_time,
      session_date
    } = sessionData;

    // 1. Check if outside allowed radius
    if (class_latitude && class_longitude && allowed_radius_meters && latitude && longitude) {
      try {
        const studentLat = parseFloat(latitude);
        const studentLon = parseFloat(longitude);
        const classLat = parseFloat(class_latitude);
        const classLon = parseFloat(class_longitude);
        const radius = parseFloat(allowed_radius_meters);

        if (!isNaN(studentLat) && !isNaN(studentLon) && !isNaN(classLat) && !isNaN(classLon) && !isNaN(radius)) {
          const distance = this.calculateDistance(studentLat, studentLon, classLat, classLon);
          attendanceData.distance_from_class_meters = Math.round(distance);

          if (distance > radius) {
            anomalies.push('outside_allowed_radius');
            score += 50;
          }
        }
      } catch (error) {
        console.warn('[ANOMALY_DETECTOR] Error calculating distance:', error.message);
      }
    }

    // 2. Check poor GPS accuracy
    if (this.isPoorGpsAccuracy(gps_accuracy)) {
      anomalies.push('poor_gps_accuracy');
      score += 15;
    }

    // 3. Check duplicate attempt (this would be checked separately in the controller)
    // anomalies.push('duplicate_attempt'); // Handled in controller

    // 4. Check expired/reused token (this would be checked separately in token service)
    // anomalies.push('expired_or_reused_token'); // Handled in token service

    // 5. Check outside session time
    if (this.isOutsideSessionTime(scan_time, start_time, end_time, session_date)) {
      anomalies.push('outside_session_time');
      score += 30;
    }

    // 6. Check different device used (this would be checked separately in controller)
    // anomalies.push('different_device_used'); // Handled in controller

    // 7. Check invalid selfie
    if (this.isSelfieInvalid(selfie)) {
      anomalies.push('selfie_missing_or_invalid');
      score += 35;
    }

    // 8. Check suspicious same location cluster (would need historical data analysis)
    // This is complex and would require analyzing multiple attendance records
    // For now, we'll skip this or implement a basic version

    // Calculate severity
    let severity = 'none';
    if (score >= 60) severity = 'high';
    else if (score >= 30) severity = 'medium';
    else if (score > 0) severity = 'low';

    return {
      anomaly_flags: anomalies.join(','),
      anomaly_score: score,
      anomaly_severity: severity,
      anomaly_review_status: 'pending',
      anomaly_notes: ''
    };
  }

  // Get anomaly description for display
  static getAnomalyDescription(flag) {
    const descriptions = {
      'outside_allowed_radius': 'Student location is outside the allowed classroom radius',
      'poor_gps_accuracy': 'GPS accuracy is poor (>50 meters)',
      'duplicate_attempt': 'Duplicate attendance attempt detected',
      'expired_or_reused_token': 'Token has expired or been reused',
      'outside_session_time': 'Attendance marked outside session time window',
      'different_device_used': 'Different device used than previously registered',
      'selfie_missing_or_invalid': 'Selfie is missing or invalid',
      'suspicious_same_location_cluster': 'Multiple students from same suspicious location'
    };
    return descriptions[flag] || 'Unknown anomaly';
  }

  // Get severity color for UI
  static getSeverityColor(severity) {
    const colors = {
      'none': '#10b981',    // green
      'low': '#f59e0b',     // yellow
      'medium': '#f97316',  // orange
      'high': '#ef4444'     // red
    };
    return colors[severity] || colors.none;
  }
}

module.exports = AnomalyDetector;</content>
<parameter name="filePath">c:\Users\tadiw\Desktop\ATTENDANCE SYSTEM\web-version\server\services\anomalyDetector.js