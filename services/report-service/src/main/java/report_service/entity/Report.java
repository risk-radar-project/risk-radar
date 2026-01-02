package report_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Setter
@Getter
public class Report {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @NotNull
    private String title;
    @NotNull
    private String description;
    @NotNull
    private UUID userId;

    @ElementCollection
    private List<UUID> imageIds = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private ReportCategory category;

    @Enumerated(EnumType.STRING)
    private ReportStatus status = ReportStatus.PENDING;

    @NotNull
    private LocalDateTime createdAt = LocalDateTime.now();

    // AI Verification fields
    private Boolean aiIsFake;
    private Double aiFakeProbability;
    private String aiConfidence;
    private LocalDateTime aiVerifiedAt;
}
