package com.warmpawz.booking.dto.common;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class PaginatedResult<T> {
    private List<T> items;
    private PaginationMetadata pagination;
}
