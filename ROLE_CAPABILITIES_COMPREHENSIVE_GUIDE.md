# 🎯 Role Capabilities - Comprehensive Guide

**Date:** Generated on comprehensive analysis  
**Purpose:** Complete documentation of all capabilities in the role creation model  
**Scope:** All 42+ capabilities with use cases and role fit analysis

---

## 📋 EXECUTIVE SUMMARY

### Capability Statistics

- **Total Capabilities:** 42
- **Universal Capabilities:** 4 (Available to all roles)
- **Category-Specific Capabilities:** 38
- **Roles Defined:** 18+ standard roles

### Capability Categories

1. **Universal** (4) - Available to all roles
2. **Service Provider** (3) - For service-based businesses
3. **Healthcare** (6) - Medical and clinical services
4. **Clinic** (4) - Multi-doctor clinic operations
5. **Boarding/Resort** (5) - Accommodation services
6. **Cafe** (4) - Restaurant and cafe operations
7. **Pharmacy** (3) - Pharmaceutical services
8. **Nutritionist** (2) - Nutrition and diet services
9. **Insurance** (2) - Insurance services
10. **E-Commerce** (4) - Product sales
11. **Tracking** (3) - Location and progress tracking
12. **Visual** (2) - Portfolio and gallery
13. **Shelter** (2) - NGO and adoption services
14. **Memorial** (2) - End-of-life services

---

## 🌐 UNIVERSAL CAPABILITIES

These capabilities are available to **ALL roles** and form the foundation of the platform.

---

### 1. `facility_management`

**Name:** Facility Management  
**Category:** Universal  
**Feature:** Manage multiple locations, facilities, and service centers

**Description:**
Allows vendors to manage multiple physical locations, facilities, or service centers. Includes location details, operating hours, amenities, capacity, and facility-specific settings.

**Use Cases:**
- Multi-location businesses (clinics, grooming salons, boarding facilities)
- Managing different service centers
- Setting up facility-specific configurations
- Managing facility amenities and features
- Tracking facility capacity and availability

**Best Fit Roles:**
- ✅ **veterinarian** - Multiple clinic locations
- ✅ **veterinary_clinic** - Hospital chains
- ✅ **pet_groomer** - Multiple salon locations
- ✅ **pet_boarding** - Multiple kennel facilities
- ✅ **pet_resort** - Multiple resort locations
- ✅ **pet_cafe** - Multiple cafe locations
- ✅ **pet_pharmacy** - Multiple pharmacy branches
- ✅ **pet_products_store** - Multiple store locations
- ✅ **pet_shelter** - Multiple shelter locations
- ✅ **pet_trainer** - Training centers
- ✅ **pet_photographer** - Studio locations
- ✅ **nutritionist** - Multiple consultation centers
- ✅ **insurance** - Multiple office locations

**Implementation Notes:**
- Required for all center-based services (`at_center`)
- Optional for home-based services (`at_home`)
- Essential for multi-location businesses

---

### 2. `schedule_management`

**Name:** Schedule Management  
**Category:** Universal  
**Feature:** Manage availability, time slots, and service schedules

**Description:**
Comprehensive scheduling system for managing vendor availability, time slots, working hours, breaks, holidays, and service-specific schedules. Supports multiple service styles and location-based scheduling.

**Use Cases:**
- Setting working hours for each day of the week
- Managing time slot availability
- Configuring service-specific schedules
- Setting up breaks and holidays
- Managing staff schedules
- Handling recurring availability patterns

**Best Fit Roles:**
- ✅ **ALL ROLES** - Essential for all service providers
- ✅ **veterinarian** - Appointment scheduling
- ✅ **pet_groomer** - Service slot management
- ✅ **pet_boarding** - Check-in/check-out scheduling
- ✅ **pet_trainer** - Training session scheduling
- ✅ **pet_cafe** - Table reservation scheduling
- ✅ **pet_photographer** - Photo shoot scheduling
- ✅ **pet_taxi** - Ride scheduling
- ✅ **pet_pharmacy** - Delivery scheduling

**Implementation Notes:**
- Core functionality for all booking-based services
- Supports multiple service styles (at_center, at_home, tele)
- Integrates with booking system
- Location-specific scheduling support

---

### 3. `booking`

**Name:** Booking  
**Category:** Universal  
**Feature:** Accept and manage customer bookings/appointments

**Description:**
Core booking system that allows customers to book services, appointments, or consultations. Includes booking creation, confirmation, modification, cancellation, and status tracking.

**Use Cases:**
- Customer books a service appointment
- Managing booking calendar
- Handling booking confirmations
- Processing booking cancellations
- Tracking booking status
- Managing recurring bookings

**Best Fit Roles:**
- ✅ **ALL SERVICE PROVIDERS** - Core functionality
- ✅ **veterinarian** - Veterinary appointments
- ✅ **pet_groomer** - Grooming appointments
- ✅ **pet_trainer** - Training sessions
- ✅ **pet_boarding** - Boarding reservations
- ✅ **pet_resort** - Resort bookings
- ✅ **pet_cafe** - Table reservations
- ✅ **pet_photographer** - Photo shoot bookings
- ✅ **pet_taxi** - Ride bookings
- ✅ **pet_sitter** - Pet sitting bookings
- ✅ **pet_walker** - Walking service bookings
- ✅ **pet_sunset_services** - Memorial service bookings
- ✅ **nutritionist** - Consultation bookings

**Implementation Notes:**
- Required for all service-based roles
- Not applicable for pure e-commerce roles (product sellers)
- Integrates with schedule management
- Supports multiple booking types

---

### 4. `chat`

**Name:** Chat  
**Category:** Universal  
**Feature:** Real-time messaging between customers and vendors

**Description:**
In-app messaging system for communication between customers and vendors. Supports text messages, media sharing, booking-related chat, and post-service communication.

**Use Cases:**
- Customer-vendor communication
- Booking-related queries
- Service updates and notifications
- Post-service follow-up
- Customer support
- Emergency communication

**Best Fit Roles:**
- ✅ **ALL ROLES** - Essential communication tool
- ✅ **veterinarian** - Patient consultation chat
- ✅ **pet_groomer** - Service coordination
- ✅ **pet_trainer** - Training progress updates
- ✅ **pet_boarding** - Pet status updates
- ✅ **pet_cafe** - Reservation coordination
- ✅ **pet_pharmacy** - Prescription queries
- ✅ **pet_taxi** - Ride coordination
- ✅ **pet_sitter** - Daily updates
- ✅ **pet_walker** - Walk updates

**Implementation Notes:**
- Available for all roles
- Booking-scoped chat (7-day window after completion)
- Supports media sharing
- Real-time messaging

---

## 🛠️ SERVICE PROVIDER CAPABILITIES

Capabilities specific to service-based businesses.

---

### 5. `custom_services`

**Name:** Custom Services  
**Category:** Service Provider  
**Feature:** Create and manage custom services not in the platform catalog

**Description:**
Allows vendors to create their own specialized services beyond the platform's standard catalog. Includes custom pricing, duration, description, and service-specific configurations.

**Use Cases:**
- Creating unique service offerings
- Specialized treatments or services
- Customized service packages
- Service-specific pricing models
- Brand-specific services

**Best Fit Roles:**
- ✅ **veterinarian** - Specialized treatments
- ✅ **veterinary_clinic** - Clinic-specific services
- ✅ **pet_groomer** - Custom grooming packages
- ✅ **pet_trainer** - Specialized training programs
- ✅ **pet_boarding** - Custom boarding packages
- ✅ **pet_resort** - Resort-specific services
- ✅ **pet_cafe** - Custom event packages
- ✅ **pet_photographer** - Custom photo packages
- ✅ **pet_sunset_services** - Custom memorial services
- ✅ **nutritionist** - Custom diet programs
- ✅ **pet_behaviorist** - Custom behavior programs
- ❌ **pet_products_store** - Not applicable (product-based)
- ❌ **pet_pharmacy** - Limited (prescription-based)
- ❌ **pet_shelter** - Not applicable (non-profit)

**Implementation Notes:**
- Only for `at_center` service style
- Requires admin approval
- Can be combined with package management
- Supports custom pricing and duration

---

### 6. `package_management`

**Name:** Package Management  
**Category:** Service Provider  
**Feature:** Create and manage service packages, subscriptions, and bundled offerings

**Description:**
Comprehensive package management system for creating service bundles, subscriptions, membership plans, and combo packages. Supports multiple package types, pricing models, and validity periods.

**Use Cases:**
- Creating service packages (e.g., "10 grooming sessions")
- Subscription plans (monthly grooming)
- Membership programs
- Combo packages (grooming + boarding)
- Discount packages
- Validity-based packages

**Best Fit Roles:**
- ✅ **veterinarian** - Health checkup packages
- ✅ **veterinary_clinic** - Clinic membership plans
- ✅ **pet_groomer** - Grooming packages
- ✅ **pet_trainer** - Training packages
- ✅ **pet_boarding** - Boarding packages
- ✅ **pet_resort** - Resort stay packages
- ✅ **pet_cafe** - Cafe membership plans
- ✅ **pet_photographer** - Photo shoot packages
- ✅ **pet_sunset_services** - Memorial service packages
- ✅ **nutritionist** - Diet plan packages
- ✅ **pet_behaviorist** - Behavior program packages
- ❌ **pet_products_store** - Not applicable
- ❌ **pet_shelter** - Not applicable

**Implementation Notes:**
- Only for `at_center` service style
- Requires admin approval
- Supports multiple package types
- Integrates with booking system

---

### 7. `staff_management`

**Name:** Staff Management  
**Category:** Service Provider  
**Feature:** Manage staff members, assign services, and handle staff operations

**Description:**
Complete staff management system for hiring, managing, and assigning staff members. Includes staff profiles, service assignments, schedule management, and staff-specific configurations.

**Use Cases:**
- Adding and managing staff members
- Assigning services to staff
- Managing staff schedules
- Staff performance tracking
- Multi-staff operations
- Staff-specific service offerings

**Best Fit Roles:**
- ✅ **veterinarian** - Managing veterinary staff
- ✅ **veterinary_clinic** - Multi-doctor management
- ✅ **pet_groomer** - Grooming staff management
- ✅ **pet_trainer** - Training staff
- ✅ **pet_boarding** - Care staff management
- ✅ **pet_resort** - Resort staff
- ✅ **pet_cafe** - Cafe staff
- ✅ **pet_pharmacy** - Pharmacy staff
- ✅ **pet_products_store** - Store staff
- ✅ **pet_photographer** - Photography team
- ✅ **pet_sitter** - Sitter agencies
- ✅ **nutritionist** - Nutritionist team
- ✅ **insurance** - Insurance agents
- ✅ **pet_shelter** - Shelter staff
- ❌ **pet_walker** - Usually solo operation
- ❌ **pet_taxi** - Usually solo operation

**Implementation Notes:**
- Essential for multi-staff operations
- Supports service assignment to staff
- Staff-specific schedules
- Required for larger businesses

---

## 🏥 HEALTHCARE CAPABILITIES

Capabilities specific to medical and healthcare services.

---

### 8. `prescription`

**Name:** Prescription  
**Category:** Healthcare  
**Feature:** Create, manage, and verify digital prescriptions

**Description:**
Digital prescription management system for veterinarians to create, issue, and manage prescriptions. Includes prescription templates, drug information, dosage calculations, and prescription history.

**Use Cases:**
- Creating digital prescriptions
- Prescription templates
- Drug and dosage management
- Prescription history
- Prescription sharing with pharmacies
- Prescription renewal

**Best Fit Roles:**
- ✅ **veterinarian** - Core functionality
- ✅ **veterinary_clinic** - Clinic prescriptions
- ✅ **pet_pharmacy** - Prescription verification
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable
- ❌ **pet_boarding** - Not applicable

**Implementation Notes:**
- Required for licensed veterinarians
- Integrates with pharmacy verification
- Supports prescription templates
- Digital signature support

---

### 9. `medical_records`

**Name:** Medical Records  
**Category:** Healthcare  
**Feature:** Maintain comprehensive pet medical records and history

**Description:**
Electronic medical records (EMR) system for storing and managing pet health records, treatment history, vaccinations, lab results, and medical notes.

**Use Cases:**
- Storing pet medical history
- Treatment records
- Vaccination tracking
- Lab results storage
- Medical notes and observations
- Health record sharing

**Best Fit Roles:**
- ✅ **veterinarian** - Core functionality
- ✅ **veterinary_clinic** - Clinic records
- ✅ **nutritionist** - Diet and health records
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable
- ❌ **pet_boarding** - Not applicable

**Implementation Notes:**
- HIPAA-compliant data storage
- Secure record access
- Patient history tracking
- Integration with prescriptions

---

### 10. `vet_summary`

**Name:** Vet Summary  
**Category:** Healthcare  
**Feature:** Generate veterinary consultation summaries and reports

**Description:**
Automated summary generation for veterinary consultations, including diagnosis, treatment plans, recommendations, and follow-up instructions.

**Use Cases:**
- Consultation summaries
- Treatment plan documentation
- Diagnosis reports
- Follow-up instructions
- Patient communication
- Medical documentation

**Best Fit Roles:**
- ✅ **veterinarian** - Core functionality
- ✅ **veterinary_clinic** - Clinic summaries
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Automated generation
- Template-based summaries
- Patient-friendly format
- Integration with medical records

---

### 11. `patient_monitoring`

**Name:** Patient Monitoring  
**Category:** Healthcare  
**Feature:** Monitor patient health, track vitals, and manage ongoing care

**Description:**
Patient monitoring system for tracking pet health metrics, vital signs, recovery progress, and ongoing care management.

**Use Cases:**
- Post-surgery monitoring
- Chronic condition tracking
- Vital signs monitoring
- Recovery progress tracking
- Health alerts
- Ongoing care management

**Best Fit Roles:**
- ✅ **veterinarian** - Patient care
- ✅ **veterinary_clinic** - Clinic monitoring
- ✅ **nutritionist** - Health monitoring
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Real-time monitoring
- Alert system
- Integration with medical records
- Health trend tracking

---

### 12. `tele`

**Name:** Tele Consultation  
**Category:** Healthcare  
**Feature:** Video consultation and remote veterinary services

**Description:**
Telemedicine platform for conducting video consultations, remote diagnosis, and virtual veterinary services. Includes video calling, screen sharing, and remote examination tools.

**Use Cases:**
- Video consultations
- Remote diagnosis
- Follow-up consultations
- Second opinions
- Emergency consultations
- Remote monitoring

**Best Fit Roles:**
- ✅ **veterinarian** - Telemedicine
- ✅ **veterinary_clinic** - Virtual clinic
- ✅ **pet_behaviorist** - Remote behavior consultation
- ✅ **nutritionist** - Remote diet consultation
- ❌ **pet_groomer** - Not applicable (physical service)
- ❌ **pet_boarding** - Not applicable

**Implementation Notes:**
- Video calling integration (AWS Chime)
- Screen sharing support
- Remote examination tools
- Prescription via teleconsultation

---

### 13. `emergency`

**Name:** Emergency Services  
**Category:** Healthcare  
**Feature:** Emergency veterinary services and urgent care

**Description:**
Emergency service management for handling urgent veterinary cases, emergency protocols, and 24/7 emergency availability.

**Use Cases:**
- Emergency appointments
- Urgent care services
- 24/7 availability
- Emergency protocols
- Critical case management
- Emergency notifications

**Best Fit Roles:**
- ✅ **veterinarian** - Emergency vet services
- ✅ **veterary_clinic** - Emergency clinic
- ✅ **pet_taxi** - Emergency transport
- ✅ **pet_ambulance** - Core functionality
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Priority booking system
- Emergency protocols
- 24/7 availability flag
- Urgent notification system

---

## 🏥 CLINIC-SPECIFIC CAPABILITIES

Capabilities for multi-doctor clinics and hospitals.

---

### 14. `multi_doctor_management`

**Name:** Multi-Doctor Management  
**Category:** Clinic  
**Feature:** Manage multiple doctors, their specializations, and schedules

**Description:**
Advanced staff management for clinics with multiple veterinarians. Includes doctor profiles, specializations, individual schedules, and doctor-specific service assignments.

**Use Cases:**
- Managing multiple veterinarians
- Doctor specializations
- Individual doctor schedules
- Doctor-specific services
- Multi-doctor consultations
- Doctor availability management

**Best Fit Roles:**
- ✅ **veterinary_clinic** - Core functionality
- ✅ **veterinarian** - Multi-doctor practices
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Advanced staff management
- Specialization-based routing
- Individual schedules
- Doctor-specific services

---

### 15. `ambulance_services`

**Name:** Ambulance Services  
**Category:** Clinic  
**Feature:** Pet ambulance and emergency transport services

**Description:**
Ambulance service management for emergency pet transport, including ambulance booking, GPS tracking, and emergency protocols.

**Use Cases:**
- Emergency pet transport
- Ambulance booking
- GPS tracking of ambulance
- Emergency protocols
- Critical case transport
- Hospital transfers

**Best Fit Roles:**
- ✅ **veterinary_clinic** - Clinic ambulance
- ✅ **pet_ambulance** - Core functionality
- ❌ **veterinarian** - Usually not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Emergency booking system
- GPS tracking integration
- Emergency protocols
- Priority routing

---

### 16. `diagnostic_lab`

**Name:** Diagnostic Lab  
**Category:** Clinic  
**Feature:** Laboratory services and diagnostic testing

**Description:**
Laboratory management system for diagnostic tests, lab results, sample tracking, and test result delivery.

**Use Cases:**
- Lab test booking
- Sample collection
- Test result management
- Lab report delivery
- Test history tracking
- Diagnostic services

**Best Fit Roles:**
- ✅ **veterinary_clinic** - In-house lab
- ✅ **veterinarian** - Lab services
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Test catalog management
- Sample tracking
- Result delivery system
- Integration with medical records

---

### 17. `emergency_protocols`

**Name:** Emergency Protocols  
**Category:** Clinic  
**Feature:** Standardized emergency procedures and protocols

**Description:**
Emergency protocol management for standardized emergency procedures, critical care protocols, and emergency response workflows.

**Use Cases:**
- Emergency procedures
- Critical care protocols
- Emergency response workflows
- Protocol documentation
- Staff training
- Compliance management

**Best Fit Roles:**
- ✅ **veterinary_clinic** - Clinic protocols
- ✅ **veterinarian** - Emergency protocols
- ❌ **pet_groomer** - Not applicable
- ❌ **pet_trainer** - Not applicable

**Implementation Notes:**
- Protocol documentation
- Staff training integration
- Compliance tracking
- Emergency workflow management

---

## 🏨 BOARDING/RESORT CAPABILITIES

Capabilities for accommodation and boarding services.

---

### 18. `room_management`

**Name:** Room Management  
**Category:** Boarding/Resort  
**Feature:** Manage rooms, kennels, and accommodation units

**Description:**
Room and kennel management system for boarding facilities. Includes room types, capacity, amenities, availability, and room-specific configurations.

**Use Cases:**
- Managing boarding rooms/kennels
- Room types and categories
- Room availability
- Room amenities
- Capacity management
- Room-specific pricing

**Best Fit Roles:**
- ✅ **pet_boarding** - Core functionality
- ✅ **pet_resort** - Resort rooms
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Room catalog management
- Availability tracking
- Room-specific pricing
- Amenity management

---

### 19. `nightly_pricing`

**Name:** Nightly Pricing  
**Category:** Boarding/Resort  
**Feature:** Per-night pricing model for boarding services

**Description:**
Pricing system for per-night charges in boarding facilities. Supports different rates for different room types, peak/off-peak pricing, and extended stay discounts.

**Use Cases:**
- Per-night pricing
- Room type pricing
- Peak/off-peak rates
- Extended stay discounts
- Seasonal pricing
- Multi-night packages

**Best Fit Roles:**
- ✅ **pet_boarding** - Core functionality
- ✅ **pet_resort** - Resort pricing
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Per-night calculation
- Room type pricing
- Seasonal rate management
- Extended stay discounts

---

### 20. `occupancy_tracking`

**Name:** Occupancy Tracking  
**Category:** Boarding/Resort  
**Feature:** Track room occupancy, availability, and capacity

**Description:**
Occupancy management system for tracking room availability, current occupancy, capacity utilization, and booking forecasts.

**Use Cases:**
- Room availability tracking
- Occupancy monitoring
- Capacity management
- Booking forecasts
- Overbooking prevention
- Revenue optimization

**Best Fit Roles:**
- ✅ **pet_boarding** - Core functionality
- ✅ **pet_resort** - Resort occupancy
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Real-time occupancy tracking
- Capacity management
- Booking forecast
- Overbooking prevention

---

### 21. `cctv_access`

**Name:** CCTV Access  
**Category:** Boarding/Resort  
**Feature:** Provide customers access to live CCTV feeds of their pets

**Description:**
CCTV access system allowing pet owners to view live camera feeds of their pets during boarding. Includes camera management, access control, and privacy settings.

**Use Cases:**
- Live pet monitoring
- Customer peace of mind
- Security monitoring
- Remote pet viewing
- Access control
- Privacy management

**Best Fit Roles:**
- ✅ **pet_boarding** - Core functionality
- ✅ **pet_resort** - Resort monitoring
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Live camera feed integration
- Access control system
- Privacy settings
- Customer access portal

---

### 22. `photo_updates`

**Name:** Photo Updates  
**Category:** Boarding/Resort  
**Feature:** Send regular photo updates to pet owners

**Description:**
Photo update system for sending regular photos of pets to owners during boarding, walking, or sitting services. Includes scheduled updates and manual photo sharing.

**Use Cases:**
- Daily pet photos during boarding
- Walk photo updates
- Sitting service updates
- Progress photo sharing
- Customer engagement
- Peace of mind for owners

**Best Fit Roles:**
- ✅ **pet_boarding** - Daily updates
- ✅ **pet_resort** - Resort updates
- ✅ **pet_walker** - Walk photos
- ✅ **pet_sitter** - Sitting updates
- ✅ **pet_trainer** - Training progress
- ❌ **veterinarian** - Limited use
- ❌ **pet_groomer** - Before/after photos

**Implementation Notes:**
- Scheduled photo updates
- Manual photo sharing
- Customer notification system
- Photo gallery integration

---

## ☕ CAFE CAPABILITIES

Capabilities for pet cafes and restaurants.

---

### 23. `table_management`

**Name:** Table Management  
**Category:** Cafe  
**Feature:** Manage tables, reservations, and seating

**Description:**
Table management system for pet cafes including table types, capacity, reservations, and seating management.

**Use Cases:**
- Table reservations
- Table capacity management
- Seating arrangements
- Table availability
- Pet-friendly table assignment
- Group bookings

**Best Fit Roles:**
- ✅ **pet_cafe** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Table catalog management
- Reservation system
- Capacity tracking
- Pet-friendly configurations

---

### 24. `pax_management`

**Name:** Pax Management  
**Category:** Cafe  
**Feature:** Manage guest count (people and pets) per table

**Description:**
Pax (person and pet) management for tracking guest counts, pet counts, and table capacity limits.

**Use Cases:**
- Tracking people per table
- Tracking pets per table
- Capacity management
- Group size limits
- Reservation management
- Table allocation

**Best Fit Roles:**
- ✅ **pet_cafe** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- People and pet counting
- Capacity limits
- Reservation integration
- Table allocation logic

---

### 25. `menu`

**Name:** Menu Management  
**Category:** Cafe  
**Feature:** Manage food and beverage menu items

**Description:**
Menu management system for pet cafes including food items, beverages, pet-friendly items, pricing, and menu categories.

**Use Cases:**
- Menu item management
- Food and beverage catalog
- Pricing management
- Menu categories
- Special items
- Seasonal menus

**Best Fit Roles:**
- ✅ **pet_cafe** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Menu catalog management
- Item pricing
- Category organization
- Availability management

---

### 26. `events`

**Name:** Event Management  
**Category:** Cafe  
**Feature:** Manage events, parties, and special occasions

**Description:**
Event management system for organizing pet cafe events, parties, special occasions, and group bookings.

**Use Cases:**
- Event booking
- Party planning
- Special occasions
- Group events
- Event calendar
- Event pricing

**Best Fit Roles:**
- ✅ **pet_cafe** - Core functionality
- ✅ **pet_shelter** - Adoption events
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Event calendar
- Booking system
- Group management
- Special pricing

---

## 💊 PHARMACY CAPABILITIES

Capabilities for pharmaceutical services.

---

### 27. `prescription_verification`

**Name:** Prescription Verification  
**Category:** Pharmacy  
**Feature:** Verify and validate prescriptions before dispensing

**Description:**
Prescription verification system for pharmacies to validate prescriptions, check authenticity, verify doctor credentials, and ensure compliance before dispensing medications.

**Use Cases:**
- Prescription validation
- Doctor verification
- Prescription authenticity check
- Compliance verification
- Controlled substance verification
- Prescription history

**Best Fit Roles:**
- ✅ **pet_pharmacy** - Core functionality
- ❌ **veterinarian** - Not applicable (prescriber, not verifier)
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Prescription validation
- Doctor verification
- Compliance checking
- Audit trail

---

### 28. `controlled_substances`

**Name:** Controlled Substances  
**Category:** Pharmacy  
**Feature:** Manage controlled substances and regulated medications

**Description:**
Controlled substance management for tracking, dispensing, and reporting on regulated medications. Includes inventory tracking, dispensing logs, and compliance reporting.

**Use Cases:**
- Controlled substance inventory
- Dispensing logs
- Compliance reporting
- Regulatory tracking
- Audit trails
- Restricted access

**Best Fit Roles:**
- ✅ **pet_pharmacy** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Inventory tracking
- Dispensing logs
- Compliance reporting
- Regulatory compliance

---

### 29. `expiry_management`

**Name:** Expiry Management  
**Category:** Pharmacy  
**Feature:** Track medication expiry dates and manage inventory

**Description:**
Expiry date management system for tracking medication expiration dates, managing inventory rotation, and preventing expired medication sales.

**Use Cases:**
- Expiry date tracking
- Inventory rotation
- Expired medication alerts
- FEFO (First Expired First Out) management
- Compliance management
- Safety alerts

**Best Fit Roles:**
- ✅ **pet_pharmacy** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Expiry tracking
- Alert system
- Inventory rotation
- Compliance management

---

## 🥗 NUTRITIONIST CAPABILITIES

Capabilities for nutrition and diet services.

---

### 30. `meal_plans`

**Name:** Meal Plans  
**Category:** Nutritionist  
**Feature:** Create and manage customized meal plans for pets

**Description:**
Meal plan management system for creating customized diet plans, meal schedules, and nutritional programs for pets.

**Use Cases:**
- Custom meal plan creation
- Diet program management
- Meal scheduling
- Nutritional planning
- Weight management plans
- Health-specific diets

**Best Fit Roles:**
- ✅ **nutritionist** - Core functionality
- ❌ **veterinarian** - Limited (referral-based)
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Custom plan creation
- Meal scheduling
- Nutritional tracking
- Progress monitoring

---

### 31. `diet_charts`

**Name:** Diet Charts  
**Category:** Nutritionist  
**Feature:** Create and share diet charts and nutritional guides

**Description:**
Diet chart creation and management system for generating nutritional guides, diet charts, and feeding schedules for pets.

**Use Cases:**
- Diet chart creation
- Nutritional guides
- Feeding schedules
- Portion recommendations
- Ingredient lists
- Customer sharing

**Best Fit Roles:**
- ✅ **nutritionist** - Core functionality
- ❌ **veterinarian** - Limited use
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Chart generation
- Template system
- Customer sharing
- Progress tracking

---

## 🛡️ INSURANCE CAPABILITIES

Capabilities for insurance services.

---

### 32. `policy_management`

**Name:** Policy Management  
**Category:** Insurance  
**Feature:** Manage insurance policies, coverage, and renewals

**Description:**
Insurance policy management system for creating, managing, and renewing pet insurance policies. Includes coverage details, premium management, and policy documents.

**Use Cases:**
- Policy creation
- Coverage management
- Policy renewals
- Premium tracking
- Policy documents
- Customer management

**Best Fit Roles:**
- ✅ **insurance** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Policy creation
- Coverage management
- Renewal system
- Document management

---

### 33. `claims_management`

**Name:** Claims Management  
**Category:** Insurance  
**Feature:** Process and manage insurance claims

**Description:**
Claims processing system for handling insurance claims, claim verification, approval workflows, and claim payments.

**Use Cases:**
- Claim submission
- Claim verification
- Approval workflows
- Claim processing
- Payment management
- Claim history

**Best Fit Roles:**
- ✅ **insurance** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Claim processing
- Verification system
- Approval workflows
- Payment integration

---

## 🛍️ E-COMMERCE CAPABILITIES

Capabilities for product sales and e-commerce.

---

### 34. `catalog`

**Name:** Product Catalog  
**Category:** E-Commerce  
**Feature:** Manage product catalog and inventory listings

**Description:**
Product catalog management system for creating, organizing, and managing product listings. Includes product details, categories, pricing, and availability.

**Use Cases:**
- Product listing management
- Catalog organization
- Product details
- Category management
- Pricing management
- Product search

**Best Fit Roles:**
- ✅ **pet_products_store** - Core functionality
- ✅ **pet_pharmacy** - Medication catalog
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Product catalog management
- Category organization
- Search functionality
- Inventory integration

---

### 35. `inventory`

**Name:** Inventory Management  
**Category:** E-Commerce  
**Feature:** Track and manage product inventory

**Description:**
Inventory management system for tracking stock levels, managing inventory, low stock alerts, and inventory reporting.

**Use Cases:**
- Stock level tracking
- Inventory management
- Low stock alerts
- Stock replenishment
- Inventory reporting
- Warehouse management

**Best Fit Roles:**
- ✅ **pet_products_store** - Core functionality
- ✅ **pet_pharmacy** - Medication inventory
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Real-time inventory tracking
- Low stock alerts
- Inventory reporting
- Stock management

---

### 36. `orders`

**Name:** Order Management  
**Category:** E-Commerce  
**Feature:** Process and manage customer orders

**Description:**
Order management system for processing customer orders, order tracking, order history, and order fulfillment.

**Use Cases:**
- Order processing
- Order tracking
- Order history
- Order fulfillment
- Order status updates
- Customer notifications

**Best Fit Roles:**
- ✅ **pet_products_store** - Core functionality
- ✅ **pet_pharmacy** - Prescription orders
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Order processing
- Status tracking
- Customer notifications
- Fulfillment management

---

### 37. `delivery`

**Name:** Delivery Management  
**Category:** E-Commerce  
**Feature:** Manage product delivery and shipping

**Description:**
Delivery management system for handling product delivery, shipping, tracking, and delivery scheduling.

**Use Cases:**
- Delivery scheduling
- Shipping management
- Delivery tracking
- Delivery status updates
- Route optimization
- Delivery notifications

**Best Fit Roles:**
- ✅ **pet_products_store** - Core functionality
- ✅ **pet_pharmacy** - Medication delivery
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Delivery scheduling
- Tracking integration
- Status updates
- Customer notifications

---

## 📍 TRACKING & MONITORING CAPABILITIES

Capabilities for location and progress tracking.

---

### 38. `gps_tracking`

**Name:** GPS Tracking  
**Category:** Tracking  
**Feature:** Real-time GPS tracking for mobile services

**Description:**
GPS tracking system for real-time location tracking of service providers during mobile services. Includes live tracking, route history, and location sharing.

**Use Cases:**
- Real-time service provider tracking
- Walk tracking
- Taxi/transport tracking
- Home service tracking
- Route history
- Customer safety

**Best Fit Roles:**
- ✅ **pet_walker** - Walk tracking
- ✅ **pet_taxi** - Transport tracking
- ✅ **pet_sitter** - Home service tracking
- ✅ **pet_ambulance** - Emergency tracking
- ❌ **veterinarian** - Limited use
- ❌ **pet_groomer** - Limited use (home services)

**Implementation Notes:**
- Real-time GPS tracking
- Route history
- Location sharing
- Safety features

---

### 39. `progress_tracking`

**Name:** Progress Tracking  
**Category:** Tracking  
**Feature:** Track and monitor service progress and outcomes

**Description:**
Progress tracking system for monitoring service outcomes, training progress, health improvements, and long-term results.

**Use Cases:**
- Training progress tracking
- Health improvement monitoring
- Service outcome tracking
- Progress reports
- Milestone tracking
- Long-term results

**Best Fit Roles:**
- ✅ **pet_trainer** - Training progress
- ✅ **pet_behaviorist** - Behavior progress
- ✅ **nutritionist** - Health progress
- ✅ **veterinarian** - Treatment progress
- ❌ **pet_groomer** - Limited use
- ❌ **pet_boarding** - Not applicable

**Implementation Notes:**
- Progress metrics
- Milestone tracking
- Progress reports
- Long-term monitoring

---

### 40. `distance_pricing`

**Name:** Distance Pricing  
**Category:** Tracking  
**Feature:** Pricing based on distance traveled

**Description:**
Distance-based pricing model for services that charge based on distance traveled. Includes base price plus per-kilometer pricing.

**Use Cases:**
- Taxi/transport pricing
- Home service pricing
- Distance-based charges
- Route-based pricing
- Dynamic pricing
- Fair pricing model

**Best Fit Roles:**
- ✅ **pet_taxi** - Core functionality
- ✅ **pet_ambulance** - Distance-based pricing
- ✅ **pet_relocation** - Relocation pricing
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Base price + per-km pricing
- Distance calculation
- Route optimization
- Dynamic pricing

---

## 🎨 VISUAL & PORTFOLIO CAPABILITIES

Capabilities for visual content and portfolios.

---

### 41. `portfolio`

**Name:** Portfolio  
**Category:** Visual  
**Feature:** Showcase work portfolio and service examples

**Description:**
Portfolio management system for showcasing previous work, service examples, and professional achievements.

**Use Cases:**
- Work portfolio display
- Service examples
- Before/after galleries
- Professional showcase
- Customer testimonials
- Brand building

**Best Fit Roles:**
- ✅ **pet_photographer** - Core functionality
- ✅ **pet_groomer** - Grooming portfolio
- ✅ **pet_trainer** - Training results
- ✅ **veterinarian** - Clinic showcase
- ❌ **pet_pharmacy** - Not applicable
- ❌ **pet_products_store** - Limited use

**Implementation Notes:**
- Portfolio gallery
- Image management
- Categorization
- Customer showcase

---

### 42. `gallery`

**Name:** Gallery  
**Category:** Visual  
**Feature:** Image gallery for services and work samples

**Description:**
Image gallery system for displaying service photos, work samples, and visual content.

**Use Cases:**
- Service photo gallery
- Work sample display
- Visual content management
- Customer galleries
- Before/after photos
- Service documentation

**Best Fit Roles:**
- ✅ **pet_photographer** - Core functionality
- ✅ **pet_groomer** - Grooming gallery
- ✅ **pet_trainer** - Training gallery
- ✅ **veterinarian** - Clinic gallery
- ✅ **pet_boarding** - Pet photos
- ❌ **pet_pharmacy** - Not applicable

**Implementation Notes:**
- Image gallery
- Categorization
- Customer sharing
- Visual content management

---

## 🏠 SHELTER/NGO CAPABILITIES

Capabilities for shelters and non-profit organizations.

---

### 43. `adoption`

**Name:** Pet Adoption  
**Category:** Shelter  
**Feature:** Manage pet adoption process and listings

**Description:**
Pet adoption management system for listing adoptable pets, managing adoption applications, and processing adoptions.

**Use Cases:**
- Pet listing management
- Adoption applications
- Adoption processing
- Pet profiles
- Adoption history
- Follow-up management

**Best Fit Roles:**
- ✅ **pet_shelter** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Pet listing system
- Application management
- Adoption workflow
- Follow-up tracking

---

### 44. `donation`

**Name:** Donation Management  
**Category:** Shelter  
**Feature:** Accept and manage donations

**Description:**
Donation management system for accepting donations, tracking contributions, and managing donor relationships.

**Use Cases:**
- Donation acceptance
- Donation tracking
- Donor management
- Contribution history
- Fundraising campaigns
- Tax receipts

**Best Fit Roles:**
- ✅ **pet_shelter** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Donation processing
- Donor management
- Contribution tracking
- Tax receipt generation

---

## 🌅 MEMORIAL SERVICES CAPABILITIES

Capabilities for end-of-life and memorial services.

---

### 45. `memorial`

**Name:** Memorial Services  
**Category:** Memorial  
**Feature:** Memorial and end-of-life services

**Description:**
Memorial service management for organizing end-of-life services, memorial ceremonies, and remembrance events.

**Use Cases:**
- Memorial service booking
- Ceremony planning
- Remembrance events
- Memorial packages
- Grief support services
- Memorial documentation

**Best Fit Roles:**
- ✅ **pet_sunset_services** - Core functionality
- ❌ **veterinarian** - Not applicable
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Service booking
- Ceremony planning
- Memorial packages
- Documentation system

---

### 46. `counseling`

**Name:** Grief Counseling  
**Category:** Memorial  
**Feature:** Grief counseling and support services

**Description:**
Counseling service management for providing grief support, counseling sessions, and emotional support services.

**Use Cases:**
- Grief counseling sessions
- Emotional support
- Counseling booking
- Support group management
- Follow-up counseling
- Resource sharing

**Best Fit Roles:**
- ✅ **pet_sunset_services** - Core functionality
- ❌ **veterinarian** - Limited (referral-based)
- ❌ **pet_groomer** - Not applicable

**Implementation Notes:**
- Counseling booking
- Session management
- Support resources
- Follow-up tracking

---

## 📊 CAPABILITY TO ROLE MAPPING

### Complete Role-Capability Matrix

| Capability | Veterinarian | Clinic | Groomer | Boarding | Resort | Walker | Trainer | Behaviorist | Sitter | Taxi | Products | Pharmacy | Cafe | Photographer | Shelter | Sunset | Nutritionist | Insurance |
|------------|--------------|--------|---------|----------|--------|--------|---------|-------------|--------|------|-----------|----------|------|--------------|---------|--------|--------------|----------|
| **Universal** |
| facility_management | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| schedule_management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| booking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Service Provider** |
| custom_services | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| package_management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| staff_management | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Healthcare** |
| prescription | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| medical_records | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| vet_summary | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| patient_monitoring | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| tele | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| emergency | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Clinic** |
| multi_doctor_management | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ambulance_services | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| diagnostic_lab | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| emergency_protocols | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Boarding/Resort** |
| room_management | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| nightly_pricing | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| occupancy_tracking | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| cctv_access | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| photo_updates | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cafe** |
| table_management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| pax_management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| menu | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| events | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Pharmacy** |
| prescription_verification | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| controlled_substances | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| expiry_management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Nutritionist** |
| meal_plans | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| diet_charts | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Insurance** |
| policy_management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| claims_management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **E-Commerce** |
| catalog | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| inventory | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| delivery | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tracking** |
| gps_tracking | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| progress_tracking | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| distance_pricing | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Visual** |
| portfolio | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| gallery | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Shelter** |
| adoption | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| donation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Memorial** |
| memorial | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| counseling | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

**Legend:**
- ✅ = Core/Recommended
- ⚠️ = Optional/Conditional
- ❌ = Not Applicable

---

## 🎯 ROLE-SPECIFIC CAPABILITY RECOMMENDATIONS

### Veterinarian
**Core Capabilities:**
- `booking`, `chat`, `prescription`, `medical_records`, `tele`, `emergency`
- `facility_management`, `schedule_management`, `staff_management`
- `vet_summary`, `patient_monitoring`

**Optional Capabilities:**
- `custom_services`, `package_management` (for specialized services)
- `portfolio`, `gallery` (for clinic showcase)

### Pet Groomer
**Core Capabilities:**
- `booking`, `chat`, `portfolio`, `gallery`, `staff_management`
- `facility_management`, `schedule_management`
- `custom_services`, `package_management`

**Optional Capabilities:**
- `photo_updates` (before/after photos)

### Pet Boarding
**Core Capabilities:**
- `booking`, `chat`, `cctv_access`, `photo_updates`, `staff_management`
- `facility_management`, `schedule_management`
- `room_management`, `nightly_pricing`, `occupancy_tracking`

**Optional Capabilities:**
- `custom_services`, `package_management` (for boarding packages)

### Pet Walker
**Core Capabilities:**
- `booking`, `chat`, `gps_tracking`, `photo_updates`
- `schedule_management`

**Optional Capabilities:**
- `facility_management` (if has base location)

### Pet Trainer
**Core Capabilities:**
- `booking`, `chat`, `progress_tracking`, `staff_management`
- `facility_management`, `schedule_management`
- `custom_services`, `package_management`

**Optional Capabilities:**
- `portfolio`, `gallery` (for training results)

### Pet Pharmacy
**Core Capabilities:**
- `catalog`, `inventory`, `orders`, `delivery`, `prescription`
- `facility_management`, `schedule_management`, `staff_management`
- `prescription_verification`, `controlled_substances`, `expiry_management`

**Optional Capabilities:**
- `chat` (for customer support)

### Pet Cafe
**Core Capabilities:**
- `booking`, `chat`, `menu`, `events`, `staff_management`
- `facility_management`, `schedule_management`
- `table_management`, `pax_management`
- `custom_services`, `package_management`

### Pet Shelter
**Core Capabilities:**
- `adoption`, `donation`, `events`, `staff_management`
- `facility_management`, `schedule_management`, `chat`

**Note:** No `custom_services` or `package_management` (non-profit model)

---

## 📚 IMPLEMENTATION GUIDANCE

### Adding New Capabilities

1. **Define in STANDARD_ROLE_DEFINITIONS**
   - Add capability to appropriate roles
   - Update role definitions in `vendor-role-config.tsx`

2. **Update Capability Options**
   - Add to `capabilityOptions` array in `RoleManagement.tsx`
   - Include category and label

3. **Implement Feature**
   - Create feature components
   - Add to vendor dashboard
   - Implement backend logic

4. **Update Documentation**
   - Document capability
   - Add use cases
   - Update role mappings

### Capability Best Practices

1. **Universal Capabilities**
   - Should be available to all roles
   - Core platform functionality
   - Essential for operations

2. **Category-Specific Capabilities**
   - Only for relevant roles
   - Specialized functionality
   - Role-specific features

3. **Optional Capabilities**
   - Can be enabled/disabled per role
   - Conditional features
   - Use-case dependent

---

## 🔄 CAPABILITY UPDATE PROCESS

### Using Update Capabilities Endpoint

**Endpoint:** `POST /admin/roles/update-capabilities`

**Process:**
1. Update `STANDARD_ROLE_DEFINITIONS` with new capabilities
2. Call update endpoint
3. System compares current vs standard capabilities
4. Updates roles that need changes
5. Returns statistics

**Example:**
```bash
POST /admin/roles/update-capabilities
# Updates all roles to match STANDARD_ROLE_DEFINITIONS
```

---

## ✅ CONCLUSION

This guide provides comprehensive documentation of all 46 capabilities in the role creation model. Each capability is documented with:

- **Name and Category**
- **Feature Description**
- **Use Cases**
- **Best Fit Roles**
- **Implementation Notes**

**Key Takeaways:**
- 4 Universal capabilities (all roles)
- 38 Category-specific capabilities
- Role-specific recommendations provided
- Complete role-capability matrix included

**Next Steps:**
- Use this guide when creating new roles
- Reference when adding new capabilities
- Update as new capabilities are added
- Use for role configuration decisions

---

**Document Generated:** Role Capabilities Comprehensive Guide  
**Status:** Complete - All 46 capabilities documented  
**Last Updated:** After latest git pull

