package report_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.repository.ReportRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private KafkaTemplate<String, Report> kafkaTemplate;

    @Mock
    private AuditLogClient auditLogClient;

    @InjectMocks
    private ReportService reportService;

    private UUID testReportId;
    private ReportRequest testRequest;
    private Report savedReport;

    @BeforeEach
    void setUp() {
        UUID testUserId = UUID.randomUUID();
        testReportId = UUID.randomUUID();

        testRequest = new ReportRequest(
                "Pożar w lesie",
                "Pali się las na północy.",
                54.123,
                18.456,
                testUserId,
                List.of(UUID.randomUUID(), UUID.randomUUID())
        );

        savedReport = new Report();
        savedReport.setId(testReportId);
        savedReport.setTitle(testRequest.title());
        savedReport.setDescription(testRequest.description());
        savedReport.setLatitude(testRequest.latitude());
        savedReport.setLongitude(testRequest.longitude());
        savedReport.setUserId(testRequest.userId());
        savedReport.setImageIds(testRequest.imageIds());
        savedReport.setStatus(ReportStatus.PENDING);
        savedReport.setCreatedAt(LocalDateTime.now());
    }

    @Test
    void createReport_ShouldSaveReport_And_SendToKafka() {
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        RecordMetadata recordMetadata = new RecordMetadata(
                new TopicPartition("reports", 1), 0L, 0,
                System.currentTimeMillis(), 0, 0
        );
        ProducerRecord<String, Report> producerRecord = new ProducerRecord<>("reports", savedReport);
        SendResult<String, Report> sendResult = new SendResult<>(producerRecord, recordMetadata);
        CompletableFuture<SendResult<String, Report>> successFuture = CompletableFuture.completedFuture(sendResult);

        when(kafkaTemplate.send(eq("reports"), any(Report.class))).thenReturn(successFuture);

        reportService.createReport(testRequest);

        verify(reportRepository, times(1)).save(any(Report.class));
        verify(kafkaTemplate, times(1)).send(eq("reports"), any(Report.class));
    }

    @Test
    void createReport_ShouldNotSendToKafka_WhenRepositorySaveFails() {
        RuntimeException dbException = new RuntimeException("Database error");
        when(reportRepository.save(any(Report.class))).thenThrow(dbException);

        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            reportService.createReport(testRequest);
        });

        assertEquals("Database error", thrown.getMessage());

        verify(kafkaTemplate, never()).send(anyString(), any(Report.class));
    }

    @Test
    void createReport_ShouldHandleKafkaFailureGracefully() {
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        RuntimeException kafkaException = new RuntimeException("Kafka connection failed");
        CompletableFuture<SendResult<String, Report>> failedFuture = CompletableFuture.failedFuture(kafkaException);
        when(kafkaTemplate.send(eq("reports"), any(Report.class))).thenReturn(failedFuture);

        assertDoesNotThrow(() -> {
            reportService.createReport(testRequest);
        });

        verify(reportRepository, times(1)).save(any(Report.class));
        verify(kafkaTemplate, times(1)).send(eq("reports"), any(Report.class));
    }


    @Test
    void updateReportStatus_ShouldUpdateStatus_WhenReportExists() {
        ReportStatus newStatus = ReportStatus.VERIFIED;

        when(reportRepository.findById(testReportId)).thenReturn(Optional.of(savedReport));
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        reportService.updateReportStatus(testReportId, newStatus);

        assertEquals(newStatus, savedReport.getStatus());
        verify(reportRepository).save(savedReport);
    }

    @Test
    void updateReportStatus_ShouldThrow_WhenReportNotFound() {
        when(reportRepository.findById(testReportId)).thenReturn(Optional.empty());

        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            reportService.updateReportStatus(testReportId, ReportStatus.VERIFIED);
        });

        assertEquals("Report not found", thrown.getMessage());
        verify(reportRepository, never()).save(any());
    }

    @Test
    void getReports_ShouldReturnPageFromRepository() {
        Pageable pageable = PageRequest.of(0, 10);
        List<Report> reportList = List.of(savedReport);
        Page<Report> mockPage = new PageImpl<>(reportList, pageable, reportList.size());

        when(reportRepository.findAll(pageable)).thenReturn(mockPage);

        Page<Report> result = reportService.getReports(pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        verify(reportRepository, times(1)).findAll(pageable);
    }

    @Test
    void getReportById_ShouldReturnReport_WhenFound() {
        when(reportRepository.findById(testReportId)).thenReturn(Optional.of(savedReport));

        Report result = reportService.getReportById(testReportId);

        assertNotNull(result);
        assertEquals(testReportId, result.getId());
    }

    @Test
    void getReportById_ShouldThrowRuntimeException_WhenNotFound() {
        when(reportRepository.findById(testReportId)).thenReturn(Optional.empty());

        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            reportService.getReportById(testReportId);
        });

        assertEquals("Report not found", thrown.getMessage());
    }
}