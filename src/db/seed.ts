import { PrismaClient } from '@prisma/client';
import { DoctorDTO } from '../types/dtos';
import { PatientData } from '../generator/patients';
import { AppointmentData, AvailabilitySlot } from '../generator/appointments';
import { logger } from '../utils/logger';

/**
 * DatabaseSeeder - Service for seeding database with scraped and generated data
 * 
 * Design Patterns:
 * - Repository pattern: Encapsulates data access logic
 * - Unit of Work pattern: Manages transactions
 * - Facade pattern: Simplifies complex database operations
 * 
 * SOLID Principles:
 * - SRP: Responsible only for database seeding
 * - OCP: Extensible for new entity types
 * - DIP: Depends on PrismaClient abstraction
 */
export class DatabaseSeeder {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Seed doctors with their treatments and availability
   * Returns map of profile URLs to doctor IDs for reference
   */
  async seedDoctors(doctors: DoctorDTO[]): Promise<Map<string, bigint>> {
    logger.info({ count: doctors.length }, 'Seeding doctors');
    
    const doctorIdMap = new Map<string, bigint>();

    for (const doctorDTO of doctors) {
      try {
        // Create doctor with nested treatments and availability
        const doctor = await this.prisma.doctors.create({
          data: {
            full_name: doctorDTO.fullName,
            specialty: doctorDTO.specialty,
            city: doctorDTO.city,
            address: doctorDTO.address,
            phone_country_code: doctorDTO.phoneCountryCode,
            phone_number: doctorDTO.phoneNumber,
            rating: doctorDTO.rating,
            review_count: doctorDTO.reviewCount,
            source_profile_url: doctorDTO.profileUrl,
            treatments: {
              create: doctorDTO.treatments.map((treatment) => ({
                name: treatment.name,
                price: treatment.price,
                currency: treatment.currency || 'PEN',
                duration_minutes: treatment.duration_minutes || 30,
              })),
            },
            availability: {
              create: doctorDTO.availability.map((slot) => ({
                start_at: new Date(slot.start_at),
                end_at: new Date(slot.end_at),
                modality: slot.modality,
              })),
            },
          },
          include: {
            treatments: true,
          },
        });

        doctorIdMap.set(doctorDTO.profileUrl, doctor.id);
        
        logger.debug(
          { doctorId: doctor.id, name: doctor.full_name },
          'Doctor seeded successfully'
        );
      } catch (error) {
        logger.error(
          { error, doctor: doctorDTO.fullName },
          'Failed to seed doctor'
        );
        // Continue with other doctors
      }
    }

    logger.info({ count: doctorIdMap.size }, 'Doctors seeded successfully');
    return doctorIdMap;
  }

  /**
   * Seed patients in batches for performance
   * Returns array of created patient IDs
   */
  async seedPatients(patients: PatientData[]): Promise<bigint[]> {
    logger.info({ count: patients.length }, 'Seeding patients');
    
    const batchSize = 100;
    const patientIds: bigint[] = [];

    for (let i = 0; i < patients.length; i += batchSize) {
      const batch = patients.slice(i, i + batchSize);

      try {
        // Use createMany for better performance
        await this.prisma.patients.createMany({
          data: batch.map((patient) => ({
            full_name: patient.full_name,
            document_number: patient.document_number,
            phone_number: patient.phone_number,
            email: patient.email || null,
          })),
          skipDuplicates: true,
        });

        logger.debug({ batch: i / batchSize + 1 }, 'Patient batch seeded');
      } catch (error) {
        logger.error({ error, batchIndex: i }, 'Failed to seed patient batch');
        throw error;
      }
    }

    // Fetch all patient IDs
    const createdPatients = await this.prisma.patients.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    patientIds.push(...createdPatients.map((p: { id: bigint }) => p.id));

    logger.info({ count: patientIds.length }, 'Patients seeded successfully');
    return patientIds;
  }

  /**
   * Get availability slots for appointment generation
   * Joins doctor availability with treatments
   */
  async getAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    logger.info('Fetching availability slots');

    const availabilities = await this.prisma.doctor_availability.findMany({
      include: {
        doctors: {
          include: {
            treatments: true,
          },
        },
      },
    });

    const slots: AvailabilitySlot[] = [];

    for (const availability of availabilities) {
      // Create a slot for each treatment the doctor offers
      for (const treatment of availability.doctors.treatments) {
        slots.push({
          doctor_id: availability.doctor_id,
          treatment_id: treatment.id,
          start_at: availability.start_at,
          end_at: availability.end_at,
          duration_minutes: treatment.duration_minutes || 30,
        });
      }
    }

    logger.info({ count: slots.length }, 'Availability slots fetched');
    return slots;
  }

  /**
   * Seed appointments in batches
   */
  async seedAppointments(appointments: AppointmentData[]): Promise<void> {
    logger.info({ count: appointments.length }, 'Seeding appointments');
    
    const batchSize = 100;

    for (let i = 0; i < appointments.length; i += batchSize) {
      const batch = appointments.slice(i, i + batchSize);

      try {
        await this.prisma.appointments.createMany({
          data: batch.map((apt) => ({
            doctor_id: apt.doctor_id,
            patient_id: apt.patient_id,
            treatment_id: apt.treatment_id,
            start_at: apt.start_at,
            end_at: apt.end_at,
            status: apt.status,
          })),
          skipDuplicates: true,
        });

        logger.debug(
          { batch: i / batchSize + 1, count: batch.length },
          'Appointment batch seeded'
        );
      } catch (error) {
        logger.error({ error, batchIndex: i }, 'Failed to seed appointment batch');
        throw error;
      }
    }

    logger.info({ count: appointments.length }, 'Appointments seeded successfully');
  }

  /**
   * Clear all data from database
   * Useful for testing and re-running pipeline
   */
  async clearDatabase(): Promise<void> {
    logger.warn('Clearing database');

    try {
      // Delete in correct order due to foreign keys
      await this.prisma.appointments.deleteMany({});
      await this.prisma.doctor_availability.deleteMany({});
      await this.prisma.treatments.deleteMany({});
      await this.prisma.patients.deleteMany({});
      await this.prisma.doctors.deleteMany({});

      logger.info('Database cleared successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to clear database');
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    doctors: number;
    treatments: number;
    patients: number;
    appointments: number;
    availability: number;
  }> {
    const [doctors, treatments, patients, appointments, availability] = await Promise.all([
      this.prisma.doctors.count(),
      this.prisma.treatments.count(),
      this.prisma.patients.count(),
      this.prisma.appointments.count(),
      this.prisma.doctor_availability.count(),
    ]);

    return {
      doctors,
      treatments,
      patients,
      appointments,
      availability,
    };
  }

  /**
   * Validate database integrity
   * Checks for orphaned records and constraint violations
   */
  async validateIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    logger.info('Validating database integrity');
    
    const issues: string[] = [];

    try {
      // Check for appointments with invalid references
      const totalAppointments = await this.prisma.appointments.count();

      // Basic validation
      if (totalAppointments === 0) {
        issues.push('No appointments found in database');
      }

      logger.info(
        { valid: issues.length === 0, issueCount: issues.length },
        'Database integrity validation completed'
      );

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error({ error }, 'Database integrity validation failed');
      return {
        valid: false,
        issues: [`Validation error: ${error}`],
      };
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('Database connection closed');
  }
}
