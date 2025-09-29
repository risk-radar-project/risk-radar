package report_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import report_service.entity.Report;

import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {
}
