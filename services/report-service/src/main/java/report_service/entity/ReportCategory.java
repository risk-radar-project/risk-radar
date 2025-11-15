package report_service.entity;

/**
 * Kategoryzacja zgłoszeń miejskich wraz z przyjazną nazwą
 * oraz identyfikatorem ikony z biblioteki Google Material Symbols.
 */
public enum ReportCategory {

    INFRASTRUCTURE("Infrastruktura i awarie", "pothole"),
    ROAD_SAFETY("Bezpieczeństwo i ruch drogowy", "traffic"),
    CLEANLINESS("Porządek i czystość", "cleaning_services"),
    VANDALISM("Wandalizm i zniszczenia", "format_paint"),
    ENVIRONMENTAL_HAZARD("Zagrożenia środowiskowe", "biohazard"),
    OTHER("Pozostałe / Inne", "help_outline");

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
     * @return String np. "Infrastruktura i awarie"
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * Zwraca nazwę ikony Google Material Symbols.
     * @return String np. "pothole"
     */
    public String getIconName() {
        return iconName;
    }
}
