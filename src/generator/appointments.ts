import { logger } from '../utils/logger';

/**
 * Appointment data structure
 */
export interface AppointmentData {
  doctor_id: bigint;
  patient_id: bigint;
  treatment_id: bigint;
  start_at: Date;
  end_at: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
}

/**
 * Doctor availability slot
 */
export interface AvailabilitySlot {
  doctor_id: bigint;
  treatment_id: bigint;
  start_at: Date;
  end_at: Date;
  duration_minutes: number;
}

/**
 * AppointmentGenerator - Creates realistic appointments
 * 
 * Design Patterns:
 * - Strategy pattern: Different generation strategies
 * - Builder pattern: Constructs appointments step by step
 * - Factory pattern: Creates appointment instances
 * 
 * SOLID Principles:
 * - SRP: Single responsibility of appointment generation
 * - OCP: Open for extension (new appointment types)
 * - LSP: Can be substituted with different generators
 * - ISP: Focused interface for appointment generation
 * - DIP: Depends on abstractions (AvailabilitySlot)
 */
export class AppointmentGenerator {
  /**
   * Generate appointments from available slots
   * Implements business logic for realistic appointment distribution
   * 
   * @param availableSlots Doctor availability slots with treatment info
   * @param patientIds Array of patient IDs to assign
   * @param fillRate Percentage of slots to fill (0-1), default 0.7 (70%)
   */
  generateAppointments(
    availableSlots: AvailabilitySlot[],
    patientIds: bigint[],
    fillRate = 0.7
  ): AppointmentData[] {
    logger.info(
      { slotCount: availableSlots.length, patientCount: patientIds.length, fillRate },
      'Generating appointments'
    );

    if (patientIds.length === 0) {
      logger.warn('No patients available for appointment generation');
      return [];
    }

    const appointments: AppointmentData[] = [];
    const usedPatientIndices = new Set<number>();

    // Sort slots by start time for chronological generation
    const sortedSlots = [...availableSlots].sort(
      (a, b) => a.start_at.getTime() - b.start_at.getTime()
    );

    for (const slot of sortedSlots) {
      // Randomly decide if this slot should be filled based on fill rate
      if (Math.random() > fillRate) {
        continue;
      }

      // Generate time slots within the availability window
      const timeSlots = this.splitAvailabilityIntoSlots(
        slot.start_at,
        slot.end_at,
        slot.duration_minutes
      );

      for (const { start, end } of timeSlots) {
        // Stop if we've filled the desired percentage
        if (Math.random() > fillRate) {
          continue;
        }

        // Select a random patient (prefer new patients)
        const patientId = this.selectPatient(patientIds, usedPatientIndices);
        
        // Determine appointment status based on time
        const status = this.determineAppointmentStatus(start);

        appointments.push({
          doctor_id: slot.doctor_id,
          patient_id: patientId,
          treatment_id: slot.treatment_id,
          start_at: start,
          end_at: end,
          status,
        });

        // Track patient usage (but allow repeats after some appointments)
        if (usedPatientIndices.size < patientIds.length * 0.8) {
          usedPatientIndices.add(patientIds.indexOf(patientId));
        }
      }
    }

    logger.info({ count: appointments.length }, 'Appointments generated successfully');
    return appointments;
  }

  /**
   * Split availability window into appointment time slots
   * @param start Start of availability window
   * @param end End of availability window
   * @param durationMinutes Duration of each appointment
   */
  private splitAvailabilityIntoSlots(
    start: Date,
    end: Date,
    durationMinutes: number
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    let currentStart = new Date(start);
    const endTime = end.getTime();

    while (currentStart.getTime() < endTime) {
      const currentEnd = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);

      // Don't create slots that extend beyond availability window
      if (currentEnd.getTime() > endTime) {
        break;
      }

      slots.push({
        start: new Date(currentStart),
        end: currentEnd,
      });

      currentStart = currentEnd;
    }

    return slots;
  }

  /**
   * Select a patient for an appointment
   * Implements fair distribution with some patient repeats
   */
  private selectPatient(patientIds: bigint[], usedIndices: Set<number>): bigint {
    // 70% chance to select a new patient if available
    if (usedIndices.size < patientIds.length && Math.random() < 0.7) {
      // Find unused patient
      let attempts = 0;
      while (attempts < 100) {
        const randomIndex = Math.floor(Math.random() * patientIds.length);
        if (!usedIndices.has(randomIndex)) {
          return patientIds[randomIndex];
        }
        attempts++;
      }
    }

    // Otherwise, select random patient (allows repeats for realistic data)
    const randomIndex = Math.floor(Math.random() * patientIds.length);
    return patientIds[randomIndex];
  }

  /**
   * Determine appointment status based on time
   * Past appointments are more likely to be completed or cancelled
   */
  private determineAppointmentStatus(appointmentTime: Date): AppointmentData['status'] {
    const now = new Date();
    const isPast = appointmentTime < now;

    if (!isPast) {
      // Future appointments are scheduled
      return 'scheduled';
    }

    // Past appointments have various statuses
    const random = Math.random();
    
    if (random < 0.75) {
      return 'completed'; // 75% completed
    } else if (random < 0.90) {
      return 'cancelled'; // 15% cancelled
    } else {
      return 'no_show'; // 10% no-show
    }
  }

  /**
   * Generate appointments with specific status distribution
   * Useful for testing and controlled scenarios
   */
  generateAppointmentsWithDistribution(
    availableSlots: AvailabilitySlot[],
    patientIds: bigint[],
    distribution: {
      scheduled?: number;
      completed?: number;
      cancelled?: number;
      no_show?: number;
    }
  ): AppointmentData[] {
    const appointments = this.generateAppointments(availableSlots, patientIds, 1.0);

    // Normalize distribution
    const total = (distribution.scheduled || 0) +
                  (distribution.completed || 0) +
                  (distribution.cancelled || 0) +
                  (distribution.no_show || 0);

    if (total === 0) {
      return appointments;
    }

    const normalizedDist = {
      scheduled: (distribution.scheduled || 0) / total,
      completed: (distribution.completed || 0) / total,
      cancelled: (distribution.cancelled || 0) / total,
      no_show: (distribution.no_show || 0) / total,
    };

    // Assign statuses based on distribution
    let scheduledCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    for (const appointment of appointments) {
      const random = Math.random();
      
      if (random < normalizedDist.scheduled) {
        appointment.status = 'scheduled';
        scheduledCount++;
      } else if (random < normalizedDist.scheduled + normalizedDist.completed) {
        appointment.status = 'completed';
        completedCount++;
      } else if (random < normalizedDist.scheduled + normalizedDist.completed + normalizedDist.cancelled) {
        appointment.status = 'cancelled';
        cancelledCount++;
      } else {
        appointment.status = 'no_show';
      }
    }

    logger.info(
      { scheduled: scheduledCount, completed: completedCount, cancelled: cancelledCount },
      'Appointments generated with custom distribution'
    );

    return appointments;
  }

  /**
   * Validate appointment doesn't overlap with existing ones
   * Useful for ensuring data quality
   */
  validateNoOverlap(
    newAppointment: AppointmentData,
    existingAppointments: AppointmentData[]
  ): boolean {
    const sameDoctorAppointments = existingAppointments.filter(
      (apt) => apt.doctor_id === newAppointment.doctor_id
    );

    for (const existing of sameDoctorAppointments) {
      const newStart = newAppointment.start_at.getTime();
      const newEnd = newAppointment.end_at.getTime();
      const existingStart = existing.start_at.getTime();
      const existingEnd = existing.end_at.getTime();

      // Check for overlap
      if (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      ) {
        return false; // Overlap detected
      }
    }

    return true; // No overlap
  }
}
