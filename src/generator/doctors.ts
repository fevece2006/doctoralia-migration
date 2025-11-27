import { faker } from '@faker-js/faker/locale/es';
import { logger } from '../utils/logger';
import { DoctorDTO, TreatmentDTO, AvailabilityDTO } from '../types/dtos';

/**
 * DoctorGenerator - Generates realistic doctor data as fallback
 * 
 * Design Patterns:
 * - Factory pattern: Creates doctor objects
 * - Builder pattern: Constructs doctor data incrementally
 * 
 * SOLID Principles:
 * - SRP: Only responsible for doctor data generation
 * - OCP: Extensible for different specialties
 */
export class DoctorGenerator {
  private readonly specialties = [
    'Medicina general',
    'Pediatría',
    'Dermatología',
    'Cardiología',
    'Ginecología',
    'Oftalmología',
    'Traumatología',
    'Psiquiatría',
    'Neurología',
    'Endocrinología',
  ];

  private readonly cities = [
    'Lima',
    'Arequipa',
    'Trujillo',
    'Cusco',
    'Chiclayo',
    'Piura',
  ];

  private readonly treatmentsBySpecialty: Record<string, string[]> = {
    'Medicina general': [
      'Consulta general',
      'Control de presión arterial',
      'Examen físico completo',
      'Certificado médico',
      'Chequeo preventivo',
    ],
    'Pediatría': [
      'Control de niño sano',
      'Vacunación',
      'Evaluación de crecimiento y desarrollo',
      'Tratamiento de infecciones respiratorias',
      'Orientación nutricional pediátrica',
    ],
    'Dermatología': [
      'Tratamiento de acné',
      'Eliminación de lunares',
      'Tratamiento de manchas',
      'Evaluación de lesiones cutáneas',
      'Tratamiento antienvejecimiento',
    ],
    'Cardiología': [
      'Electrocardiograma',
      'Ecocardiograma',
      'Prueba de esfuerzo',
      'Holter de presión',
      'Control de hipertensión',
    ],
    'Ginecología': [
      'Examen ginecológico',
      'Papanicolaou',
      'Ecografía transvaginal',
      'Control prenatal',
      'Planificación familiar',
    ],
    'Oftalmología': [
      'Examen de la vista',
      'Receta de lentes',
      'Evaluación de glaucoma',
      'Cirugía de cataratas',
      'Control de diabetes ocular',
    ],
    'Traumatología': [
      'Evaluación de fracturas',
      'Infiltraciones',
      'Cirugía de rodilla',
      'Tratamiento de esguinces',
      'Rehabilitación física',
    ],
    'Psiquiatría': [
      'Evaluación psiquiátrica',
      'Tratamiento de depresión',
      'Tratamiento de ansiedad',
      'Terapia cognitivo-conductual',
      'Manejo de estrés',
    ],
    'Neurología': [
      'Electroencefalograma',
      'Tratamiento de migraña',
      'Evaluación de epilepsia',
      'Evaluación de mareos',
      'Control de Parkinson',
    ],
    'Endocrinología': [
      'Control de diabetes',
      'Evaluación de tiroides',
      'Tratamiento de obesidad',
      'Evaluación hormonal',
      'Control metabólico',
    ],
  };

  /**
   * Generate a single doctor with realistic data
   */
  generateDoctor(specialty?: string, city?: string): DoctorDTO {
    const selectedSpecialty = specialty || faker.helpers.arrayElement(this.specialties);
    const selectedCity = city || faker.helpers.arrayElement(this.cities);
    const gender = faker.person.sexType();
    
    const firstName = faker.person.firstName(gender);
    const lastName1 = faker.person.lastName();
    const lastName2 = faker.person.lastName();
    const fullName = `${firstName} ${lastName1} ${lastName2}`;

    // Generate profile URL based on specialty and name
    const specialtySlug = this.getSpecialtySlug(selectedSpecialty);
    const nameSlug = fullName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    const profileUrl = `https://www.doctoralia.pe/${nameSlug}/${specialtySlug}/${selectedCity.toLowerCase()}`;

    const treatments = this.generateTreatments(selectedSpecialty);
    const availability = this.generateAvailability();

    return {
      fullName,
      specialty: selectedSpecialty,
      city: selectedCity,
      address: this.generateAddress(selectedCity),
      phoneCountryCode: '+51',
      phoneNumber: this.generatePeruvianPhone(),
      rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0 - 5.0
      reviewCount: faker.number.int({ min: 5, max: 500 }),
      profileUrl,
      treatments,
      availability,
    };
  }

  /**
   * Generate multiple doctors
   */
  generateDoctors(count: number, specialty?: string, city?: string): DoctorDTO[] {
    logger.info({ count, specialty, city }, 'Generating mock doctors');
    
    const doctors: DoctorDTO[] = [];
    for (let i = 0; i < count; i++) {
      doctors.push(this.generateDoctor(specialty, city));
    }

    logger.info({ count: doctors.length }, 'Mock doctors generated');
    return doctors;
  }

  /**
   * Generate treatments for a specialty
   */
  private generateTreatments(specialty: string): TreatmentDTO[] {
    const treatmentNames = this.treatmentsBySpecialty[specialty] || this.treatmentsBySpecialty['Medicina general'];
    const count = faker.number.int({ min: 3, max: 5 });
    
    return faker.helpers.arrayElements(treatmentNames, count).map(name => ({
      name,
      description: `Tratamiento especializado de ${name.toLowerCase()}`,
      price: parseFloat((Math.random() * 150 + 50).toFixed(2)), // S/ 50 - 200
      currency: 'PEN',
      duration_minutes: faker.helpers.arrayElement([30, 45, 60, 90]),
    }));
  }

  /**
   * Generate availability slots for a week
   */
  private generateAvailability(): AvailabilityDTO[] {
    const availability: AvailabilityDTO[] = [];
    const today = new Date();
    
    // Generate availability for the next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // Skip some days randomly (doctors don't work every day)
      if (Math.random() > 0.6) {
        continue;
      }
      
      // Morning shift (9 AM - 1 PM)
      if (Math.random() > 0.3) {
        const startMorning = new Date(date);
        startMorning.setHours(9, 0, 0, 0);
        const endMorning = new Date(date);
        endMorning.setHours(13, 0, 0, 0);
        
        availability.push({
          start_at: startMorning.toISOString(),
          end_at: endMorning.toISOString(),
          modality: Math.random() > 0.5 ? 'in_person' : 'online',
        });
      }
      
      // Afternoon shift (3 PM - 7 PM)
      if (Math.random() > 0.2) {
        const startAfternoon = new Date(date);
        startAfternoon.setHours(15, 0, 0, 0);
        const endAfternoon = new Date(date);
        endAfternoon.setHours(19, 0, 0, 0);
        
        availability.push({
          start_at: startAfternoon.toISOString(),
          end_at: endAfternoon.toISOString(),
          modality: Math.random() > 0.5 ? 'in_person' : 'online',
        });
      }
    }

    return availability;
  }

  /**
   * Generate Peruvian phone number (9 digits)
   */
  private generatePeruvianPhone(): string {
    // Peruvian mobile numbers start with 9
    return `9${faker.string.numeric(8)}`;
  }

  /**
   * Generate address for a city
   */
  private generateAddress(city: string): string {
    const streetTypes = ['Av.', 'Jr.', 'Ca.', 'Psje.'];
    const streetType = faker.helpers.arrayElement(streetTypes);
    const streetName = faker.location.street();
    const number = faker.number.int({ min: 100, max: 9999 });
    const district = this.getDistrictByCity(city);
    
    return `${streetType} ${streetName} ${number}, ${district}, ${city}`;
  }

  /**
   * Get typical district for a city
   */
  private getDistrictByCity(city: string): string {
    const districts: Record<string, string[]> = {
      'Lima': ['San Isidro', 'Miraflores', 'San Borja', 'Surco', 'La Molina', 'Jesús María'],
      'Arequipa': ['Cercado', 'Cayma', 'Yanahuara', 'Cerro Colorado'],
      'Trujillo': ['Centro', 'Víctor Larco', 'La Esperanza'],
      'Cusco': ['Centro Histórico', 'Wanchaq', 'Santiago'],
      'Chiclayo': ['Centro', 'José Leonardo Ortiz'],
      'Piura': ['Centro', 'Castilla'],
    };

    const cityDistricts = districts[city] || ['Centro'];
    return faker.helpers.arrayElement(cityDistricts);
  }

  /**
   * Get URL slug for specialty
   */
  private getSpecialtySlug(specialty: string): string {
    const slugs: Record<string, string> = {
      'Medicina general': 'medico-general',
      'Pediatría': 'pediatra',
      'Dermatología': 'dermatologo',
      'Cardiología': 'cardiologo',
      'Ginecología': 'ginecologo',
      'Oftalmología': 'oftalmologo',
      'Traumatología': 'traumatologo',
      'Psiquiatría': 'psiquiatra',
      'Neurología': 'neurologo',
      'Endocrinología': 'endocrinologo',
    };

    return slugs[specialty] || 'medico-general';
  }
}
