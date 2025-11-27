export interface TreatmentDTO {
name: string;
price?: number;
currency?: string;
duration_minutes?: number;
}


export interface AvailabilityDTO {
start_at: string; // ISO
end_at: string; // ISO
modality: 'in_person' | 'online';
}


export interface DoctorDTO {
fullName: string;
specialty: string;
city: string;
address?: string;
phoneCountryCode?: string;
phoneNumber?: string;
rating?: number;
reviewCount?: number;
profileUrl: string;
treatments: TreatmentDTO[];
availability: AvailabilityDTO[];
}