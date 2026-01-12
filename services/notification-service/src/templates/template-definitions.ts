import { NotificationChannel, NotificationEvent } from "../types/events";

export interface TemplateDefinition {
    templateKey: string;
    eventType: NotificationEvent["eventType"];
    channel: NotificationChannel;
    title?: string;
    subject?: string;
    body?: string;
    bodyFile?: string;
}

const placeholder = "{{placeholder}}";

export const templateDefinitions: TemplateDefinition[] = [
    {
        templateKey: "USER_REGISTERED_IN_APP",
        eventType: "USER_REGISTERED",
        channel: "in_app",
        title: "Witaj w serwisie!",
        body: "Twoje konto zostało pomyślnie utworzone."
    },
    {
        templateKey: "USER_REGISTERED_EMAIL",
        eventType: "USER_REGISTERED",
        channel: "email",
        subject: "Witaj w Risk Radar!",
        bodyFile: "user-registered.html"
    },
    {
        templateKey: "PASSWORD_CHANGED_EMAIL",
        eventType: "PASSWORD_CHANGED",
        channel: "email",
        subject: "Twoje hasło zostało zmienione",
        bodyFile: "password-changed.html"
    },
    {
        templateKey: "AUDIT_SECURITY_EVENT_DETECTED_IN_APP",
        eventType: "AUDIT_SECURITY_EVENT_DETECTED",
        channel: "in_app",
        title: "Alert bezpieczeństwa",
        body: "Wykryto zdarzenie bezpieczeństwa wymagające uwagi."
    },
    {
        templateKey: "AUDIT_SECURITY_EVENT_DETECTED_EMAIL",
        eventType: "AUDIT_SECURITY_EVENT_DETECTED",
        channel: "email",
        subject: "Alert bezpieczeństwa w RiskRadar",
        bodyFile: "audit-security-event.html"
    },
    {
        templateKey: "ROLE_ASSIGNED_IN_APP",
        eventType: "ROLE_ASSIGNED",
        channel: "in_app",
        title: "Nowa rola przypisana",
        body: "Twoja rola w systemie została zaktualizowana."
    },
    {
        templateKey: "ROLE_ASSIGNED_EMAIL",
        eventType: "ROLE_ASSIGNED",
        channel: "email",
        subject: "Przypisano nową rolę",
        bodyFile: "role-assigned.html"
    },
    {
        templateKey: "ROLE_REVOKED_IN_APP",
        eventType: "ROLE_REVOKED",
        channel: "in_app",
        title: "Rola cofnięta",
        body: "Jedna z Twoich ról została cofnięta."
    },
    {
        templateKey: "MEDIA_APPROVED_IN_APP",
        eventType: "MEDIA_APPROVED",
        channel: "in_app",
        title: "Plik zatwierdzony",
        body: "Twój przesłany plik został zatwierdzony i jest teraz widoczny."
    },
    {
        templateKey: "MEDIA_REJECTED_IN_APP",
        eventType: "MEDIA_REJECTED",
        channel: "in_app",
        title: "Plik odrzucony",
        body: "Twój przesłany plik został odrzucony. Powód: {{reason}}"
    },
    {
        templateKey: "MEDIA_REJECTED_EMAIL",
        eventType: "MEDIA_REJECTED",
        channel: "email",
        subject: "Twój plik został odrzucony",
        bodyFile: "media-rejected.html"
    },
    {
        templateKey: "MEDIA_FLAGGED_NSFW_IN_APP",
        eventType: "MEDIA_FLAGGED_NSFW",
        channel: "in_app",
        title: "Plik oznaczony jako wrażliwy",
        body: "Twój plik został oznaczony jako zawierający treści wrażliwe (NSFW)."
    },
    {
        templateKey: "MEDIA_FLAGGED_NSFW_EMAIL",
        eventType: "MEDIA_FLAGGED_NSFW",
        channel: "email",
        subject: "Plik oznaczony jako wrażliwy",
        bodyFile: "media-flagged-nsfw.html"
    },
    {
        templateKey: "MEDIA_CENSORED_IN_APP",
        eventType: "MEDIA_CENSORED",
        channel: "in_app",
        title: "Plik ocenzurowany",
        body: "Twój plik został ocenzurowany przez moderację."
    },
    {
        templateKey: "MEDIA_DELETED_SYSTEM_IN_APP",
        eventType: "MEDIA_DELETED_SYSTEM",
        channel: "in_app",
        title: "Plik usunięty",
        body: "Twój plik został automatycznie usunięty przez system."
    },
    {
        templateKey: "MEDIA_STORAGE_THRESHOLD_IN_APP",
        eventType: "MEDIA_STORAGE_THRESHOLD",
        channel: "in_app",
        title: "Osiągnięto limit przestrzeni",
        body: "Wykorzystanie przestrzeni dyskowej osiągnęło {{threshold}}%. Rozważ usunięcie starych plików."
    },
    {
        templateKey: "MEDIA_STORAGE_THRESHOLD_EMAIL",
        eventType: "MEDIA_STORAGE_THRESHOLD",
        channel: "email",
        subject: "Próg wykorzystania przestrzeni osiągnięty",
        bodyFile: "media-storage-threshold.html"
    },
    {
        templateKey: "USER_PASSWORD_RESET_REQUESTED_EMAIL",
        eventType: "USER_PASSWORD_RESET_REQUESTED",
        channel: "email",
        subject: "Resetuj hasło w RiskRadar",
        bodyFile: "user-password-reset-requested.html"
    },
    {
        templateKey: "USER_BANNED_IN_APP",
        eventType: "USER_BANNED",
        channel: "in_app",
        title: "Konto zablokowane",
        body: "Twoje konto zostało zablokowane. Powód: {{reason}}"
    },
    {
        templateKey: "USER_BANNED_EMAIL",
        eventType: "USER_BANNED",
        channel: "email",
        subject: "Twoje konto zostało zablokowane",
        bodyFile: "user-banned.html"
    },
    {
        templateKey: "USER_UNBANNED_IN_APP",
        eventType: "USER_UNBANNED",
        channel: "in_app",
        title: "Konto odblokowane",
        body: "Twoje konto zostało odblokowane. Możesz ponownie korzystać z systemu."
    },
    {
        templateKey: "USER_UNBANNED_EMAIL",
        eventType: "USER_UNBANNED",
        channel: "email",
        subject: "Twoje konto zostało odblokowane",
        bodyFile: "user-unbanned.html"
    },
    {
        templateKey: "REPORT_CATEGORIZED_IN_APP",
        eventType: "REPORT_CATEGORIZED",
        channel: "in_app",
        title: "Raport skategoryzowany",
        body: "Twój raport został automatycznie skategoryzowany jako: {{category}}"
    },
    {
        templateKey: "FAKE_REPORT_DETECTED_IN_APP",
        eventType: "FAKE_REPORT_DETECTED",
        channel: "in_app",
        title: "Wykryto podejrzany raport",
        body: "Twój raport został oznaczony jako potencjalnie nieprawdziwy."
    },
    {
        templateKey: "FAKE_REPORT_DETECTED_EMAIL",
        eventType: "FAKE_REPORT_DETECTED",
        channel: "email",
        subject: "Wykryto podejrzany raport",
        bodyFile: "fake-report-detected.html"
    },
    {
        templateKey: "REPORT_CREATED_EMAIL",
        eventType: "REPORT_CREATED",
        channel: "email",
        subject: "Twoje zgłoszenie zostało utworzone",
        bodyFile: "report-created.html"
    },
    {
        templateKey: "REPORT_STATUS_CHANGED_EMAIL",
        eventType: "REPORT_STATUS_CHANGED",
        channel: "email",
        subject: "Status Twojego zgłoszenia uległ zmianie",
        bodyFile: "report-status-changed.html"
    }
];

export const templateMap: Record<string, TemplateDefinition> = templateDefinitions.reduce(
    (acc, template) => {
        acc[template.templateKey] = template;
        return acc;
    },
    {} as Record<string, TemplateDefinition>
);

