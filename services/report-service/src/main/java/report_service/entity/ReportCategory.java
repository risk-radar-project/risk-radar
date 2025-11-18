package report_service.entity;

/**
 * Kategoryzacja zgłoszeń miejskich wraz z przyjazną nazwą
 * oraz identyfikatorem ikony z biblioteki Google Material Symbols.
 */
public enum ReportCategory {

    VANDALISM("Wandalizm", "format_paint"),
    INFRASTRUCTURE("Infrastruktura drogowa/chodników", "construction"),
    DANGEROUS_SITUATION("Niebezpieczne sytuacje", "warning"),
    TRAFFIC_ACCIDENT("Wypadki drogowe", "car_crash"),
    PARTICIPANT_BEHAVIOR("Zachowania kierowców/pieszych", "person_alert"),
    PARTICIPANT_HAZARD("Zagrożenia dla pieszych i rowerzystów i kierowców", "brightness_alert"),
    WASTE_ILLEGAL_DUMPING("Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci", "delete_sweep"),
    BIOLOGICAL_HAZARD("Zagrożenia biologiczne", "bug_report"),
    OTHER("Inne", "help_outline");

    private final String displayName;
    private final String iconName;

    /**
     * Konstruktor enuma
     * @param displayName Polska nazwa do wyświetlenia w UI
     * @param iconName Nazwa kodowa ikony z Google Material Symbols
     */
    ReportCategory(String displayName, String iconName) {
        this.displayName = displayName;
        this.iconName = iconName;
    }

    /**
     * Zwraca polską nazwę kategorii.
     * @return String np. "Wandalizm"
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * Zwraca nazwę ikony Google Material Symbols.
     * @return String np. "format_paint"
     */
    public String getIconName() {
        return iconName;
    }
}