import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { PlaywrightScraper } from '../scraping/playwrightScraper';
import { DoctorScraper } from '../scraping/doctorScraper';
import { DoctorGenerator } from '../generator/doctors';
import { PatientGenerator } from '../generator/patients';
import { AppointmentGenerator } from '../generator/appointments';
import { DatabaseSeeder } from '../db/seed';
import { DoctorDTO } from '../types/dtos';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Pipeline configuration from environment
 */
interface PipelineConfig {
  cities: string[];
  specialties: string[];
  doctorsPerSearch: number;
  patientsCount: number;
  appointmentFillRate: number;
  clearDatabaseFirst: boolean;
}

/**
 * MigrationPipeline - Main orchestrator for the data migration process
 * 
 * Design Patterns:
 * - Facade pattern: Simplifies complex workflow
 * - Template Method pattern: Defines algorithm skeleton
 * - Chain of Responsibility: Sequential processing steps
 * 
 * SOLID Principles:
 * - SRP: Orchestrates the pipeline, delegates to specialized services
 * - OCP: Can be extended with new pipeline steps
 * - DIP: Depends on abstractions (scraper, generator, seeder interfaces)
 */
class MigrationPipeline {
  private config: PipelineConfig;
  private prisma: PrismaClient;
  private scraper: PlaywrightScraper;
  private doctorScraper: DoctorScraper;
  private doctorGenerator: DoctorGenerator;
  private patientGenerator: PatientGenerator;
  private appointmentGenerator: AppointmentGenerator;
  private seeder: DatabaseSeeder;

  constructor() {
    this.config = this.loadConfiguration();
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
    this.scraper = new PlaywrightScraper();
    this.doctorScraper = new DoctorScraper(this.scraper);
    this.doctorGenerator = new DoctorGenerator();
    this.patientGenerator = new PatientGenerator();
    this.appointmentGenerator = new AppointmentGenerator();
    this.seeder = new DatabaseSeeder(this.prisma);
  }

  /**
   * Load and validate configuration from environment
   */
  private loadConfiguration(): PipelineConfig {
    const cities = (process.env.SCRAPE_CITIES || 'Lima,Arequipa')
      .split(',')
      .map((c: string) => c.trim());

    const specialties = (process.env.SCRAPE_SPECIALTIES || 'Medicina general,Pediatría')
      .split(',')
      .map((s: string) => s.trim());

    return {
      cities,
      specialties,
      doctorsPerSearch: parseInt(process.env.DOCTORS_PER_SEARCH || '5', 10),
      patientsCount: parseInt(process.env.PATIENTS_COUNT || '100', 10),
      appointmentFillRate: parseFloat(process.env.APPOINTMENT_FILL_RATE || '0.7'),
      clearDatabaseFirst: process.env.CLEAR_DATABASE === 'true',
    };
  }

  /**
   * Execute the complete migration pipeline
   * Template Method pattern - defines the algorithm structure
   */
  async execute(): Promise<void> {
    const startTime = Date.now();
    
    logger.info('========================================');
    logger.info('Starting Doctoralia Migration Pipeline');
    logger.info('========================================');
    logger.info({ config: this.config }, 'Pipeline configuration');

    try {
      // Step 1: Initialize
      await this.initialize();

      // Step 2: Scrape doctor data
      const doctors = await this.scrapeDoctors();

      // Step 3: Seed doctors to database
      await this.seedDoctors(doctors);

      // Step 4: Generate and seed patients
      await this.generateAndSeedPatients();

      // Step 5: Generate and seed appointments
      await this.generateAndSeedAppointments();

      // Step 6: Validate and report
      await this.validateAndReport();

      // Step 7: Cleanup
      await this.cleanup();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('========================================');
      logger.info({ duration: `${duration}s` }, 'Pipeline completed successfully');
      logger.info('========================================');

      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Pipeline execution failed');
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Step 1: Initialize all services
   */
  private async initialize(): Promise<void> {
    logger.info('Step 1: Initializing services');

    // Test database connection
    await this.prisma.$connect();
    logger.info('Database connection established');

    // Clear database if configured
    if (this.config.clearDatabaseFirst) {
      await this.seeder.clearDatabase();
    }

    // Initialize browser
    await this.scraper.initialize();
    logger.info('Scraper initialized');
  }

  /**
   * Step 2: Scrape doctor profiles from Doctoralia
   */
  private async scrapeDoctors(): Promise<DoctorDTO[]> {
    logger.info('Step 2: Scraping doctor profiles');

    const allDoctors: DoctorDTO[] = [];

    // Scrape for each combination of city and specialty
    for (const city of this.config.cities) {
      for (const specialty of this.config.specialties) {
        try {
          logger.info({ city, specialty }, 'Searching doctors');

          // Search for doctors
          const profileUrls = await this.doctorScraper.searchDoctors(
            specialty,
            city,
            this.config.doctorsPerSearch
          );

          logger.info(
            { count: profileUrls.length, city, specialty },
            'Profile URLs found'
          );

          // Scrape each profile
          for (const url of profileUrls) {
            const doctor = await this.doctorScraper.scrapeDoctorProfile(url);
            
            if (doctor) {
              allDoctors.push(doctor);
              logger.info(
                { name: doctor.fullName, specialty: doctor.specialty },
                'Doctor profile scraped'
              );
            }

            // Rate limiting
            await this.delay(2000);
          }
        } catch (error) {
          logger.error({ error, city, specialty }, 'Failed to scrape city/specialty');
          // Continue with other combinations
        }
      }
    }

    logger.info({ count: allDoctors.length }, 'Total doctors scraped');

    // If scraping failed or returned too few doctors, generate mock data as fallback
    if (allDoctors.length === 0) {
      logger.warn('No doctors scraped, generating mock data as fallback');
      return this.generateMockDoctors();
    } else if (allDoctors.length < 10) {
      logger.warn({ scraped: allDoctors.length }, 'Few doctors scraped, supplementing with mock data');
      const mockDoctors = this.generateMockDoctors();
      allDoctors.push(...mockDoctors.slice(0, 20 - allDoctors.length));
    }

    return allDoctors;
  }

  /**
   * Generate mock doctors when scraping fails
   */
  private generateMockDoctors(): DoctorDTO[] {
    logger.info('Generating mock doctor data');
    const mockDoctors: DoctorDTO[] = [];

    // Generate doctors for each city/specialty combination
    for (const city of this.config.cities) {
      for (const specialty of this.config.specialties) {
        const doctors = this.doctorGenerator.generateDoctors(
          this.config.doctorsPerSearch,
          specialty,
          city
        );
        mockDoctors.push(...doctors);
      }
    }

    logger.info({ count: mockDoctors.length }, 'Mock doctors generated');
    return mockDoctors;
  }

  /**
   * Step 3: Seed doctors to database
   */
  private async seedDoctors(doctors: DoctorDTO[]): Promise<void> {
    logger.info('Step 3: Seeding doctors to database');

    if (doctors.length === 0) {
      logger.warn('No doctors to seed');
      return;
    }

    await this.seeder.seedDoctors(doctors);
    logger.info('Doctors seeded successfully');
  }

  /**
   * Step 4: Generate and seed patients
   */
  private async generateAndSeedPatients(): Promise<void> {
    logger.info('Step 4: Generating and seeding patients');

    const patients = this.patientGenerator.generatePatients(this.config.patientsCount);
    await this.seeder.seedPatients(patients);
    
    logger.info({ count: patients.length }, 'Patients seeded successfully');
  }

  /**
   * Step 5: Generate and seed appointments
   */
  private async generateAndSeedAppointments(): Promise<void> {
    logger.info('Step 5: Generating and seeding appointments');

    // Get availability slots from database
    const availabilitySlots = await this.seeder.getAvailabilitySlots();
    
    if (availabilitySlots.length === 0) {
      logger.warn('No availability slots found, skipping appointments');
      return;
    }

    // Get patient IDs
    const patients = await this.prisma.patients.findMany({
      select: { id: true },
    });
    const patientIds = patients.map((p: { id: bigint }) => p.id);

    if (patientIds.length === 0) {
      logger.warn('No patients found, skipping appointments');
      return;
    }

    // Generate appointments
    const appointments = this.appointmentGenerator.generateAppointments(
      availabilitySlots,
      patientIds,
      this.config.appointmentFillRate
    );

    // Seed to database
    await this.seeder.seedAppointments(appointments);
    
    logger.info({ count: appointments.length }, 'Appointments seeded successfully');
  }

  /**
   * Step 6: Validate data and generate report
   */
  private async validateAndReport(): Promise<void> {
    logger.info('Step 6: Validating and generating report');

    // Get statistics
    const stats = await this.seeder.getStatistics();
    
    logger.info('========================================');
    logger.info('Database Statistics:');
    logger.info(`  Doctors: ${stats.doctors}`);
    logger.info(`  Treatments: ${stats.treatments}`);
    logger.info(`  Availability Slots: ${stats.availability}`);
    logger.info(`  Patients: ${stats.patients}`);
    logger.info(`  Appointments: ${stats.appointments}`);
    logger.info('========================================');

    // Validate integrity
    const validation = await this.seeder.validateIntegrity();
    
    if (!validation.valid) {
      logger.warn({ issues: validation.issues }, 'Data integrity issues detected');
    } else {
      logger.info('Data integrity validation passed');
    }

    // Get sample appointments by status
    const appointmentsByStatus = await this.prisma.appointments.groupBy({
      by: ['status'],
      _count: true,
    });

    logger.info('Appointments by status:');
    appointmentsByStatus.forEach((group: { status: string; _count: number }) => {
      logger.info(`  ${group.status}: ${group._count}`);
    });
  }

  /**
   * Step 7: Cleanup resources
   */
  private async cleanup(): Promise<void> {
    logger.info('Step 7: Cleaning up resources');

    try {
      await this.scraper.close();
      await this.seeder.disconnect();
      logger.info('Resources cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Error during cleanup');
    }
  }

  /**
   * Utility: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Main entry point
 */
async function main() {
  const pipeline = new MigrationPipeline();
  await pipeline.execute();
}

// Execute pipeline
main().catch((error) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});
