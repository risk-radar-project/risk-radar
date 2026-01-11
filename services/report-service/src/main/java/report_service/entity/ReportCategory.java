package report_service.entity;

/**
 * Categorization of city reports with user-friendly names
 * and icon identifiers from Google Material Symbols library.
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
     * Enum constructor
     * @param displayName Display name for UI (in Polish)
     * @param iconName Icon code name from Google Material Symbols
     */
    ReportCategory(String displayName, String iconName) {
        this.displayName = displayName;
        this.iconName = iconName;
    }

    /**
     * Returns the category display name.
     * @return String e.g. "Wandalizm"
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * Returns the Google Material Symbols icon name.
     * @return String e.g. "format_paint"
     */
    public String getIconName() {
        return iconName;
    }
}
