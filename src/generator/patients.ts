import { faker } from '@faker-js/faker/locale/es';
import { logger } from '../utils/logger';

/**
 * Patient data for database seeding
 */
export interface PatientData {
  full_name: string;
  document_number?: string;
  phone_number?: string;
  email?: string;
}

/**
 * PatientGenerator - Generates realistic patient data
 * 
 * Design Patterns:
 * - Factory pattern: Creates patient objects
 * - Builder pattern: Constructs patient data incrementally
 * 
 * SOLID Principles:
 * - SRP: Only responsible for patient generation
 * - OCP: Extensible for different patient types
 */
export class PatientGenerator {
  constructor() {
    // Configure faker for Peru
    faker.setDefaultRefDate(new Date());
  }

  /**
   * Generate a single patient with realistic Peruvian data
   */
  generatePatient(): PatientData {
    const gender = faker.person.sexType();
    
    return {
      full_name: faker.person.fullName({ sex: gender }),
      document_number: this.generateDNI(),
      phone_number: this.generatePeruvianPhone(),
      email: this.generateEmail(),
    };
  }

  /**
   * Generate multiple patients
   * @param count Number of patients to generate
   */
  generatePatients(count: number): PatientData[] {
    logger.info({ count }, 'Generating patients');
    
    const patients: PatientData[] = [];
    
    for (let i = 0; i < count; i++) {
      patients.push(this.generatePatient());
    }

    logger.info({ count: patients.length }, 'Patients generated successfully');
    return patients;
  }

  /**
   * Generate Peruvian DNI (8 digits)
   * DNI format: 12345678
   */
  private generateDNI(): string {
    // Generate 8-digit DNI (common in Peru)
    const dni = faker.number.int({ min: 10000000, max: 99999999 });
    return dni.toString();
  }

  /**
   * Generate Peruvian phone number
   * Format: 9XXXXXXXX (9 digits starting with 9 for mobile)
   */
  private generatePeruvianPhone(): string {
    // Peruvian mobile numbers start with 9 and have 9 digits total
    const phone = '9' + faker.string.numeric(8);
    return phone;
  }

  /**
   * Generate realistic email
   */
  private generateEmail(): string {
    // 80% of patients have email, 20% don't
    if (Math.random() < 0.2) {
      return '';
    }

    return faker.internet.email().toLowerCase();
  }

  /**
   * Generate patient with specific characteristics
   * Useful for testing edge cases
   */
  generatePatientWithOptions(options: {
    withEmail?: boolean;
    withPhone?: boolean;
    withDocument?: boolean;
  }): PatientData {
    const patient = this.generatePatient();

    if (options.withEmail === false) {
      patient.email = undefined;
    }

    if (options.withPhone === false) {
      patient.phone_number = undefined;
    }

    if (options.withDocument === false) {
      patient.document_number = undefined;
    }

    return patient;
  }
}
