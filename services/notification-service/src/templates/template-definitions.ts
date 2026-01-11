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
        body: "Twoje hasło do konta Risk Radar zostało pomyślnie zmienione. Jeśli to nie Ty, skontaktuj się z administratorem."
    },
    {
        templateKey: "AUDIT_SECURITY_EVENT_DETECTED_IN_APP",
        eventType: "AUDIT_SECURITY_EVENT_DETECTED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "AUDIT_SECURITY_EVENT_DETECTED_EMAIL",
        eventType: "AUDIT_SECURITY_EVENT_DETECTED",
        channel: "email",
        subject: placeholder,
        body: placeholder
    },
    {
        templateKey: "ROLE_ASSIGNED_IN_APP",
        eventType: "ROLE_ASSIGNED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "ROLE_ASSIGNED_EMAIL",
        eventType: "ROLE_ASSIGNED",
        channel: "email",
        subject: placeholder,
        body: placeholder
    },
    {
        templateKey: "ROLE_REVOKED_IN_APP",
        eventType: "ROLE_REVOKED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_APPROVED_IN_APP",
        eventType: "MEDIA_APPROVED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_REJECTED_IN_APP",
        eventType: "MEDIA_REJECTED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_REJECTED_EMAIL",
        eventType: "MEDIA_REJECTED",
        channel: "email",
        subject: placeholder,
        body: placeholder
    },
    {
        templateKey: "MEDIA_FLAGGED_NSFW_IN_APP",
        eventType: "MEDIA_FLAGGED_NSFW",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_FLAGGED_NSFW_EMAIL",
        eventType: "MEDIA_FLAGGED_NSFW",
        channel: "email",
        subject: placeholder,
        body: placeholder
    },
    {
        templateKey: "MEDIA_CENSORED_IN_APP",
        eventType: "MEDIA_CENSORED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_DELETED_SYSTEM_IN_APP",
        eventType: "MEDIA_DELETED_SYSTEM",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_STORAGE_THRESHOLD_IN_APP",
        eventType: "MEDIA_STORAGE_THRESHOLD",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "MEDIA_STORAGE_THRESHOLD_EMAIL",
        eventType: "MEDIA_STORAGE_THRESHOLD",
        channel: "email",
        subject: placeholder,
        body: placeholder
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
        title: "{{title}}",
        body: "{{body}}"
    },
    {
        templateKey: "USER_BANNED_EMAIL",
        eventType: "USER_BANNED",
        channel: "email",
        subject: placeholder,
        body: placeholder
    },
    {
        templateKey: "USER_UNBANNED_IN_APP",
        eventType: "USER_UNBANNED",
        channel: "in_app",
        title: "{{title}}",
        body: "{{body}}"
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
        body: "Twój raport został oznaczony jako potencjalnie nieprawdziwy. Prawdopodobieństwo: {{fake_probability}}%"
    }
];

export const templateMap: Record<string, TemplateDefinition> = templateDefinitions.reduce(
    (acc, template) => {
        acc[template.templateKey] = template;
        return acc;
    },
    {} as Record<string, TemplateDefinition>
);

