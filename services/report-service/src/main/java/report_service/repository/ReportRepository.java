package report_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import report_service.entity.Report;
import report_service.entity.ReportStatus;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID>, JpaSpecificationExecutor<Report> {
    List<Report> findByStatus(ReportStatus status);

    long countByStatus(ReportStatus status);

    long countByCreatedAtAfter(java.time.LocalDateTime date);

    /**
     * Find reports within a radius using Haversine formula
     * Returns reports that are potentially dangerous (VERIFIED or PENDING status)
     * 
     * @param latitude  User's latitude
     * @param longitude User's longitude
     * @param radiusKm  Search radius in kilometers
     * @return List of reports within the specified radius
     */
    @Query(value = """
            SELECT * FROM report r
            WHERE r.status IN ('VERIFIED', 'PENDING')
            AND (
                6371 * acos(
                    cos(radians(:latitude)) * cos(radians(r.latitude)) *
                    cos(radians(r.longitude) - radians(:longitude)) +
                    sin(radians(:latitude)) * sin(radians(r.latitude))
                )
            ) <= :radiusKm
            ORDER BY r.created_at DESC
            """, nativeQuery = true)
    List<Report> findReportsWithinRadius(
            @Param("latitude") Double latitude,
            @Param("longitude") Double longitude,
            @Param("radiusKm") Double radiusKm);
}
