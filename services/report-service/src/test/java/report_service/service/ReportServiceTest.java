package report_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentMatchers;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestTemplate;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.repository.ReportRepository;

import report_service.entity.ReportCategory;
import report_service.service.NotificationClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private NotificationClient notificationClient;

    @Mock
    private RestTemplateBuilder restTemplateBuilder;

    @Mock
    private RestTemplate restTemplate;

    private ReportService reportService;

    private UUID testReportId;
    private ReportRequest testRequest;
    private Report savedReport;

    @BeforeEach
    void setUp() {
        UUID testUserId = UUID.randomUUID();
        testReportId = UUID.randomUUID();

        testRequest = new ReportRequest(
                "Forest fire",
                "Fire burning in the northern forest.",
                54.123,
                18.456,
                testUserId,
                List.of(UUID.randomUUID(), UUID.randomUUID()),
                null);

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

        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        reportService = new ReportService(reportRepository, kafkaTemplate, notificationClient, restTemplateBuilder, "");
    }

    @Test
    void createReport_ShouldSaveReport_And_SendToKafka() {
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        RecordMetadata recordMetadata = new RecordMetadata(
            new TopicPartition("report", 1), 0L, 0,
            System.currentTimeMillis(), 0, 0);
        ProducerRecord<String, Object> producerRecord = new ProducerRecord<>("report", savedReport.getId().toString(),
            Map.of("id", savedReport.getId().toString()));
        SendResult<String, Object> sendResult = new SendResult<>(producerRecord, recordMetadata);
        CompletableFuture<SendResult<String, Object>> successFuture = CompletableFuture.completedFuture(sendResult);

        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(successFuture);

        reportService.createReport(testRequest);

        verify(reportRepository, times(1)).save(any(Report.class));
        verify(kafkaTemplate, times(1)).send(anyString(), anyString(), any());
    }

    @Test
    void getUserReports_ShouldReturnPageOfReports() {
        UUID userId = savedReport.getUserId();
        Pageable pageable = PageRequest.of(0, 10);
        Page<Report> page = new PageImpl<>(List.of(savedReport));

        when(reportRepository.findUserReports(eq(userId), isNull(), isNull(), eq(pageable))).thenReturn(page);

        Page<Report> result = reportService.getUserReports(userId, null, null, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(savedReport.getId(), result.getContent().get(0).getId());
        verify(reportRepository, times(1)).findUserReports(eq(userId), isNull(), isNull(), eq(pageable));
    }

    @Test
    void deleteReport_ShouldDelete_WhenUserIsOwner() {
        UUID userId = savedReport.getUserId();
        when(reportRepository.findById(testReportId)).thenReturn(Optional.of(savedReport));

        reportService.deleteReport(testReportId, userId);

        verify(reportRepository, times(1)).delete(any(Report.class));
    }

    @Test
    void deleteReport_ShouldThrowException_WhenUserIsNotOwner() {
        UUID otherUserId = UUID.randomUUID();
        when(reportRepository.findById(testReportId)).thenReturn(Optional.of(savedReport));

        assertThrows(SecurityException.class, () -> {
            reportService.deleteReport(testReportId, otherUserId);
        });

        verify(reportRepository, never()).delete(any(Report.class));
    }

    @Test
    void createReport_ShouldNotSendToKafka_WhenRepositorySaveFails() {
        RuntimeException dbException = new RuntimeException("Database error");
        when(reportRepository.save(any(Report.class))).thenThrow(dbException);

        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            reportService.createReport(testRequest);
        });

        assertEquals("Database error", thrown.getMessage());

        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    void createReport_ShouldHandleKafkaFailureGracefully() {
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        RuntimeException kafkaException = new RuntimeException("Kafka connection failed");
        CompletableFuture<SendResult<String, Object>> failedFuture = CompletableFuture.failedFuture(kafkaException);
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(failedFuture);

        assertDoesNotThrow(() -> {
            reportService.createReport(testRequest);
        });

        verify(reportRepository, times(1)).save(any(Report.class));
        verify(kafkaTemplate, times(1)).send(anyString(), anyString(), any());
    }

    @Test
    void updateReportStatus_ShouldUpdateStatus_WhenReportExists() {
        ReportStatus newStatus = ReportStatus.VERIFIED;

        when(reportRepository.findById(testReportId)).thenReturn(Optional.of(savedReport));
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        reportService.updateReportStatus(testReportId, newStatus);

        assertEquals(newStatus, savedReport.getStatus());
        verify(reportRepository).save(savedReport);
        // after update, service should publish updated report as an object to Kafka
        verify(kafkaTemplate, times(1)).send(anyString(), eq(savedReport.getId().toString()), any());
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

        when(reportRepository.findAll(ArgumentMatchers.<Specification<Report>>any(), eq(pageable)))
                .thenReturn(mockPage);

        Page<Report> result = reportService.getReports(pageable, null, null);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        verify(reportRepository, times(1)).findAll(ArgumentMatchers.<Specification<Report>>any(),
                eq(pageable));
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
