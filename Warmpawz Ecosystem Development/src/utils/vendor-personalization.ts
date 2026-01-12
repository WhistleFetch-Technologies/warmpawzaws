import { 
  Video, 
  Clock, 
  Package, 
  DollarSign, 
  Scissors,
  Home as HomeIcon,
  Dog,
  Shield,
  Bed,
  Stethoscope,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  MapPin
} from 'lucide-react';

export interface VendorPersonalization {
  // Service location labels
  serviceLocations: {
    atFacility: {
      label: string;
      icon: any;
      description: string;
    };
    atHome: {
      label: string;
      icon: any;
      description: string;
    };
    tele: {
      label: string;
      icon: any;
      description: string;
    };
  };
  
  // Quick actions specific to vendor type
  quickActions: Array<{
    label: string;
    icon: any;
    action: string;
    color: string;
    iconColor: string;
    enabled: boolean;
  }>;
  
  // Dashboard labels
  labels: {
    scheduleTitle: string;
    subjectPlural: string; // "Patients", "Clients", "Pets"
    subjectSingular: string; // "Patient", "Client", "Pet"
    primaryService: string; // "Consultation", "Grooming Session", etc.
  };
  
  // Features enabled
  features: {
    hasTeleConsultation: boolean;
    hasPrescriptions: boolean;
    hasWatchlist: boolean;
    hasTracking: boolean; // For dog walkers
    hasCheckInOut: boolean; // For boarding
    hasInsuranceClaims: boolean;
  };
}

/**
 * Get personalized configuration for a vendor based on their type and enabled services
 */
export function getVendorPersonalization(
  vendorType: string,
  enabledServices: any[] = []
): VendorPersonalization {
  const lowerType = vendorType?.toLowerCase() || '';
  
  // Check which service types are enabled
  const hasClinicService = enabledServices.some(s => 
    s.serviceType === 'at_center' || s.serviceType === 'clinic'
  );
  const hasHomeService = enabledServices.some(s => 
    s.serviceType === 'at_home' || s.serviceType === 'home'
  );
  const hasTeleService = enabledServices.some(s => 
    s.serviceType === 'tele' || s.serviceType === 'teleconsultation'
  );
  
  // VETERINARIAN
  if (lowerType.includes('vet') || lowerType === 'veterinarian') {
    return {
      serviceLocations: {
        atFacility: {
          label: 'At Clinic',
          icon: Stethoscope,
          description: 'In-clinic consultation'
        },
        atHome: {
          label: 'Home Visit',
          icon: HomeIcon,
          description: 'Veterinary home visit'
        },
        tele: {
          label: 'Tele Consult',
          icon: Video,
          description: 'Video consultation'
        }
      },
      quickActions: [
        ...(hasTeleService ? [{
          label: 'Start Tele Consult',
          icon: Video,
          action: 'teleconsultation',
          color: 'bg-green-100',
          iconColor: 'text-green-600',
          enabled: true
        }] : []),
        {
          label: 'Manage Schedule',
          icon: Clock,
          action: 'schedule',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'Manage Services',
          icon: Package,
          action: 'services',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Today's Appointments",
        subjectPlural: 'Patients',
        subjectSingular: 'Patient',
        primaryService: 'Consultation'
      },
      features: {
        hasTeleConsultation: hasTeleService,
        hasPrescriptions: true,
        hasWatchlist: true,
        hasTracking: false,
        hasCheckInOut: false,
        hasInsuranceClaims: false
      }
    };
  }
  
  // GROOMER
  if (lowerType.includes('groom')) {
    return {
      serviceLocations: {
        atFacility: {
          label: 'At Centre',
          icon: Scissors,
          description: 'At grooming centre'
        },
        atHome: {
          label: 'Home Service',
          icon: HomeIcon,
          description: 'Mobile grooming'
        },
        tele: {
          label: 'Video Consult',
          icon: Video,
          description: 'Grooming consultation'
        }
      },
      quickActions: [
        {
          label: 'Manage Schedule',
          icon: Clock,
          action: 'schedule',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'Manage Services',
          icon: Package,
          action: 'services',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Bookings',
          icon: Calendar,
          action: 'bookings',
          color: 'bg-pink-100',
          iconColor: 'text-pink-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Today's Sessions",
        subjectPlural: 'Pets',
        subjectSingular: 'Pet',
        primaryService: 'Grooming Session'
      },
      features: {
        hasTeleConsultation: false,
        hasPrescriptions: false,
        hasWatchlist: false,
        hasTracking: false,
        hasCheckInOut: false,
        hasInsuranceClaims: false
      }
    };
  }
  
  // DOG WALKER
  if (lowerType.includes('walk') || lowerType.includes('dog walker')) {
    return {
      serviceLocations: {
        atFacility: {
          label: 'Park/Area',
          icon: MapPin,
          description: 'Designated walking area'
        },
        atHome: {
          label: 'Pickup & Walk',
          icon: HomeIcon,
          description: 'Home pickup service'
        },
        tele: {
          label: 'Video Check-in',
          icon: Video,
          description: 'Live walk updates'
        }
      },
      quickActions: [
        {
          label: 'Start Walk Session',
          icon: MapPin,
          action: 'tracking',
          color: 'bg-green-100',
          iconColor: 'text-green-600',
          enabled: true
        },
        {
          label: 'Manage Schedule',
          icon: Clock,
          action: 'schedule',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'View Routes',
          icon: Package,
          action: 'services',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Today's Walk Schedule",
        subjectPlural: 'Dogs',
        subjectSingular: 'Dog',
        primaryService: 'Walk Session'
      },
      features: {
        hasTeleConsultation: false,
        hasPrescriptions: false,
        hasWatchlist: false,
        hasTracking: true,
        hasCheckInOut: false,
        hasInsuranceClaims: false
      }
    };
  }
  
  // BOARDING / HOSTEL
  if (lowerType.includes('board') || lowerType.includes('hostel') || lowerType.includes('daycare')) {
    return {
      serviceLocations: {
        atFacility: {
          label: 'At Facility',
          icon: Bed,
          description: 'Boarding facility'
        },
        atHome: {
          label: 'Home Boarding',
          icon: HomeIcon,
          description: 'Foster home care'
        },
        tele: {
          label: 'Video Update',
          icon: Video,
          description: 'Live pet updates'
        }
      },
      quickActions: [
        ...(hasTeleService ? [{
          label: 'Send Video Update',
          icon: Video,
          action: 'teleconsultation',
          color: 'bg-green-100',
          iconColor: 'text-green-600',
          enabled: true
        }] : []),
        {
          label: 'Manage Schedule',
          icon: Clock,
          action: 'schedule',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'Manage Bookings',
          icon: Calendar,
          action: 'bookings',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Current Boarders",
        subjectPlural: 'Boarders',
        subjectSingular: 'Boarder',
        primaryService: 'Boarding'
      },
      features: {
        hasTeleConsultation: hasTeleService,
        hasPrescriptions: false,
        hasWatchlist: false,
        hasTracking: false,
        hasCheckInOut: true,
        hasInsuranceClaims: false
      }
    };
  }
  
  // INSURANCE PROVIDER
  if (lowerType.includes('insurance')) {
    return {
      serviceLocations: {
        atFacility: {
          label: 'At Office',
          icon: Shield,
          description: 'Office consultation'
        },
        atHome: {
          label: 'Home Visit',
          icon: HomeIcon,
          description: 'Home consultation'
        },
        tele: {
          label: 'Video Consult',
          icon: Video,
          description: 'Online consultation'
        }
      },
      quickActions: [
        ...(hasTeleService ? [{
          label: 'Start Consultation',
          icon: Video,
          action: 'teleconsultation',
          color: 'bg-green-100',
          iconColor: 'text-green-600',
          enabled: true
        }] : []),
        {
          label: 'Manage Claims',
          icon: FileText,
          action: 'claims',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'View Policies',
          icon: Package,
          action: 'services',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Today's Consultations",
        subjectPlural: 'Clients',
        subjectSingular: 'Client',
        primaryService: 'Consultation'
      },
      features: {
        hasTeleConsultation: hasTeleService,
        hasPrescriptions: false,
        hasWatchlist: false,
        hasTracking: false,
        hasCheckInOut: false,
        hasInsuranceClaims: true
      }
    };
  }
  
  // TRAINER
  if (lowerType.includes('train')) {
    return {
      serviceLocations: {
        atFacility: {
          label: 'At Training Centre',
          icon: Dog,
          description: 'Training facility'
        },
        atHome: {
          label: 'Home Training',
          icon: HomeIcon,
          description: 'In-home training'
        },
        tele: {
          label: 'Video Session',
          icon: Video,
          description: 'Online training'
        }
      },
      quickActions: [
        ...(hasTeleService ? [{
          label: 'Start Video Session',
          icon: Video,
          action: 'teleconsultation',
          color: 'bg-green-100',
          iconColor: 'text-green-600',
          enabled: true
        }] : []),
        {
          label: 'Manage Schedule',
          icon: Clock,
          action: 'schedule',
          color: 'bg-orange-100',
          iconColor: 'text-orange-600',
          enabled: true
        },
        {
          label: 'Training Programs',
          icon: Package,
          action: 'services',
          color: 'bg-blue-100',
          iconColor: 'text-blue-600',
          enabled: true
        },
        {
          label: 'View Earnings',
          icon: DollarSign,
          action: 'earnings',
          color: 'bg-purple-100',
          iconColor: 'text-purple-600',
          enabled: true
        }
      ],
      labels: {
        scheduleTitle: "Today's Training Sessions",
        subjectPlural: 'Trainees',
        subjectSingular: 'Trainee',
        primaryService: 'Training Session'
      },
      features: {
        hasTeleConsultation: hasTeleService,
        hasPrescriptions: false,
        hasWatchlist: false,
        hasTracking: false,
        hasCheckInOut: false,
        hasInsuranceClaims: false
      }
    };
  }
  
  // DEFAULT FALLBACK
  return {
    serviceLocations: {
      atFacility: {
        label: 'At Centre',
        icon: Package,
        description: 'At service centre'
      },
      atHome: {
        label: 'Home Visit',
        icon: HomeIcon,
        description: 'Home service'
      },
      tele: {
        label: 'Video Consult',
        icon: Video,
        description: 'Video consultation'
      }
    },
    quickActions: [
      ...(hasTeleService ? [{
        label: 'Start Consultation',
        icon: Video,
        action: 'teleconsultation',
        color: 'bg-green-100',
        iconColor: 'text-green-600',
        enabled: true
      }] : []),
      {
        label: 'Manage Schedule',
        icon: Clock,
        action: 'schedule',
        color: 'bg-orange-100',
        iconColor: 'text-orange-600',
        enabled: true
      },
      {
        label: 'Manage Services',
        icon: Package,
        action: 'services',
        color: 'bg-blue-100',
        iconColor: 'text-blue-600',
        enabled: true
      },
      {
        label: 'View Earnings',
        icon: DollarSign,
        action: 'earnings',
        color: 'bg-purple-100',
        iconColor: 'text-purple-600',
        enabled: true
      }
    ],
    labels: {
      scheduleTitle: "Today's Appointments",
      subjectPlural: 'Clients',
      subjectSingular: 'Client',
      primaryService: 'Service'
    },
    features: {
      hasTeleConsultation: hasTeleService,
      hasPrescriptions: false,
      hasWatchlist: false,
      hasTracking: false,
      hasCheckInOut: false,
      hasInsuranceClaims: false
    }
  };
}
